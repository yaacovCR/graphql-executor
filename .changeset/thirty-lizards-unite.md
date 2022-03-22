---
'graphql-executor': patch
---

introspection should track the ExecutorSchema rather than the GraphQLSchema

...in case of any discrepancy. When an explicit ExecutorSchema is passed, the GraphQLSchema should essentially be ignored, required in essence only to satisfy TS typings. If an explicit ExecutorSchema is not passed, it is generated from the GraphQLSchema, and so there would be no discrepancy.
