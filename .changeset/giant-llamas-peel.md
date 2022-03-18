---
'graphql-executor': patch
---

introduce experimental parallel streaming

Experimental `inParallel` boolean argument to the stream directive may now be used to stream list items as they are ready instead of in sequential list order.

When parallel streaming is enabled, the `data` property of execution patch results will consist of an array of items and a new `atIndices` property will contain the corresponding indices of the items.
