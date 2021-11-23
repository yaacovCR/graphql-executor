---
'graphql-executor': patch
---

Refactor mapAsyncIterator to use a Repeater implementation

This is a breaking change as the generator returned by mapAsyncIterator will now (correctly) not support concurrent next() and throw() calls. As the generator returned by calls to execute should rarely be used with throw(), this breaking change should have little impact.
