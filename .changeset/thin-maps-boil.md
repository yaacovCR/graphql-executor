---
'graphql-executor': patch
---

introduce experimental batched streaming

Experimental `maxChunkSize` and `maxInterval` arguments allows for increasing the number of items in each streamed payload up to the specified maximum size. A maximum interval (specified in milliseconds) can be used to send any ready items prior to the maximum chunk size.

When using a `maxChunkSize` greater than 1, the `data` property of execution patch results will consist of an array of items and a new `atIndex` property will contain the initial index for the items included within the chunk. When streaming in parallel, new `atIndices` property will be used instead of `atIndex` and will contain an array of the corresponding indices for each of the items included within the `data` property.
