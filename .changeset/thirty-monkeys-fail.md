---
'graphql-executor': patch
---

Skip schema validation prior to first use.

Schemas can (and should!) still be validated when and where appropriate using the dedicated graphql-js validateSchema method.

graphql-js validates previously unvalidated schemas prior to the first execution. The validation step is skipped by graphql-js if and only if the schema was created with the `assumeValid` option, which essentially triggers a faux validation run that produces no errors.

graphql-executor now simply does not automatically validate schemas, preferring to require servers to explicitly validate schemas when and where appropriate, just as document validation is a distinct, explicit step.
