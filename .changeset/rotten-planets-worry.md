---
'graphql-executor': patch
---

remove createSourceEventStream function export

BREAKING CHANGE: access to createSourceEventStream is still possible in advanced cases, but now only via an explicitly created instance of the internal Executor class.
