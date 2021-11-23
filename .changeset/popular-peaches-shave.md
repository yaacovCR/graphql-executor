---
'graphql-executor': patch
---

BREAKING CHANGE: `execute` now executes subscriptions as subscriptions, not queries, unless the new `forceQueryAlgorithm` option is set to true. The `subscribe` function has been removed.

Executing a subscription with improper arguments now throws an error (rather than returning a promise that rejects with an error), aligning execution of subscriptions to that of queries and mutations.
