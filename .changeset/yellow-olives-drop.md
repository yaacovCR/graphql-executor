---
'graphql-executor': patch
---

Allow cross-realm execution

This is made possible by avoiding instanceof checks within the executor proper.

New predicates are introduced that rely on Symbol.toStringTag (or error names) to identify objects from other realms.

Field/type resolvers and isTypeOf functions that are passed GraphQL type system entities and use native graphql-js predicates will still encounter cross-realm errors.

The new predicates are exported for convenience. Note that only the predicates actually necessary for execution are included within the change. Additional predicates are not included, but could be added on request.

Cross-realm execution can be avoided by end-users by simply calling the original isSchema predicate from graphql-js.
