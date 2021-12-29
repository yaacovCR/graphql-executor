---
'graphql-executor': patch
---

Allow cross-realm execution

This is made possible by avoiding instanceof checks within the executor proper.

New predicates are introduced that rely on Symbol.toStringTag (or error names) to identify objects from other realms.

Field/type resolvers and isTypeOf functions that are passed GraphQL type system entities and use native graphql-js predicates will still encounter cross-realm errors.

Cross-realm execution can be avoided by end-users by simply calling the original isSchema predicate from graphql-js.
