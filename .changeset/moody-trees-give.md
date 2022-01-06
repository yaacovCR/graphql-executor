---
'graphql-executor': patch
---

Fix ExecutorSchema isNonNullType method

Client documents may wrap input types with non-nullable wrapper types not present in the schema. The ExecutorSchema should recognize these non-nullable types as such.
