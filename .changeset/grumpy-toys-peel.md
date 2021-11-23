---
'graphql-executor': patch
---

Memoize field lists created by the collectFields utility function.

This allows functions that operate on these field lists to be memoized.
