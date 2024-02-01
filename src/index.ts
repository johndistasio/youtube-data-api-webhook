import { trace } from '@opentelemetry/api';
import { instrument, ResolveConfigFn } from '@microlabs/otel-cf-workers';

export interface Env {
	BUCKET: R2Bucket;
	HYPERDX_API_KEY: string;
	OTEL_SERVICE_NAME: string;
	OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: string;
}

const getChannelId = (topic: string | null) => {
	if (!topic) {
		return '';
	}

	return new URL(decodeURIComponent(topic))?.searchParams.get('channel_id') || '';
};

const handler = {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		switch (request.method) {
			case 'GET':
				const url = new URL(request.url);
				const token = url?.searchParams.get('hub.challenge');

				if (!token) {
					return new Response(null, { status: 400 });
				}

				const mode = url?.searchParams.get('hub.mode') || '';
				const lease_seconds = url?.searchParams.get('hub.lease_seconds') || '';

				trace.getActiveSpan()?.setAttribute('youtube.hub.mode', mode);
				trace.getActiveSpan()?.setAttribute('youtube.hub.lease_seconds', lease_seconds);
				trace.getActiveSpan()?.setAttribute('youtube.channel_id', getChannelId(url?.searchParams.get('hub.topic')));

				return new Response(token, { status: 200 });
			case 'POST':
				// The workers runtime does weird things with time, though
				// it is unlikely we'll receive two updates at the same moment.
				const key = `${Date.now()}.${crypto.randomUUID()}.xml`;

				const object = await env.BUCKET.put(key, request.body);

				if (!object) {
					return new Response(null, { status: 500 });
				}

				console.log(`created ${object.key}`);
				return new Response(null, { status: 200 });
			default:
				return new Response(null, { status: 405 });
		}
	},
};

const config: ResolveConfigFn = (env: Env, _trigger) => {
	return {
		exporter: {
			headers: {
				'authorization': env.HYPERDX_API_KEY,
			},
			url: env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
		},
		service: {
			name: env.OTEL_SERVICE_NAME,
		},
	}
};

export default instrument(handler, config);
