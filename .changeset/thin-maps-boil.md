---
'graphql-executor': patch
---

introduce experimental batched streaming

Experimental `maxChunkSize` and `maxInterval` arguments allows for increasing the number of items in each streamed payload up to the specified maximum size. A maximum interval (specified in milliseconds) can be used to send any ready items prior to the maximum chunk size.

When using a `maxChunkSize` greater than 1, the `data` property of execution patch results will consist of an array of items and a new `atIndex` property will contain the initial index for the items included within the chunk.

These options can be combined with parallel streaming. When streaming in parallel, the `data` property will always consist on an array of items and the `atIndices` property will always consist of an array of the matching indices, even when `maxChunkSize` is equal to 1. If these new arguments prove popular, `data` should probably be an array even when `maxChunkSize` is equal to one, even without parallel streaming.
