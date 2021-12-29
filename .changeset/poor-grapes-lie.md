---
'graphql-executor': patch
---

Introduce the `ExecutorSchema` interface

`graphql-executor` "upgrades" `GraphQLSchema` objects created with `graphql-js` v14 and v15 to a `graphql-js` v16-compatibile version by providing utility functions that analyze the schema and provide all the necessary metadata. This change introduces the the `ExecutorSchema` interface so that clients can explicitly perform this schema preparation step.

The included (memoized) `toExectorSchema` utility function generates an `ExecutorSchema` from a `GraphQLSchema` object and is called implicitly if only a `GraphQLSchema` is passed to the executor. Using the new `executorSchema` option, however, a pre-specified `ExecutorSchema` instance can be used. In this case, the `GraphQLSchema` passed via the `schema` option is never used by `graphql-executor` and only required so that it can be passed through to resolvers via the `info` argument.

The `ExecutorSchema` is also passed to resolvers within an `executorSchema` property added to the `info` argument (using TypeScript interface merging). This property is populated both when the `ExecutorSchema` is provided explicitly and when it is generated from the `GraphQLSchema`.

BREAKING CHANGE:

The `Executor` class is now instantiated with an configuration object containing a `schema` of type `GraphQLSchema` and an optional `executorSchema` of type `ExecutorSchema`. Previously, the executor was instantiated without any parameters.

NOTE:

When the executor is instantiated with both a `schema` and an `executorSchema`:

1. `graphql-executor` does not validate the `schema` or `executorSchema`.
2. `graphql-executor` does not check whether the `executorSchema` matches the `schema`.
3. `graphql-executor` does not utilize the `schema` in any way except to pass its value to resolvers as a property of the `info` argument.
