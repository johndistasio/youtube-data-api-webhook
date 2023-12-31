# youtube-data-api-webhook

Simple webhook to examine/verify push notifications from the YouTube Data API.

https://developers.google.com/youtube/v3/guides/push_notifications

Stores notification in R2 because a) it's cheap, and b) worker logs aren't persistent.