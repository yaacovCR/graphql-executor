# graphql-executor

## 0.0.22

### Patch Changes

- 00f54c0d: introspection should track the ExecutorSchema rather than the GraphQLSchema

  ...in case of any discrepancy. When an explicit ExecutorSchema is passed, the GraphQLSchema should essentially be ignored, required in essence only to satisfy TS typings. If an explicit ExecutorSchema is not passed, it is generated from the GraphQLSchema, and so there would be no discrepancy.

## 0.0.21

### Patch Changes

- 83d92585: fix batch parallel streaming in combination with deferred fragments

## 0.0.20

### Patch Changes

- 6b067721: introduce experimental parallel streaming

  Experimental `inParallel` boolean argument to the stream directive may now be used to stream list items as they are ready instead of in sequential list order.

- 99a85d47: introduce experimental batched streaming

  Experimental `maxChunkSize` and `maxInterval` arguments allows for increasing the number of items in each streamed payload up to the specified maximum size. A maximum interval (specified in milliseconds) can be used to send any ready items prior to the maximum chunk size.

  When using a `maxChunkSize` greater than 1, the `data` property of execution patch results will consist of an array of items and a new `atIndex` property will contain the initial index for the items included within the chunk. When streaming in parallel, new `atIndices` property will be used instead of `atIndex` and will contain an array of the corresponding indices for each of the items included within the `data` property.

## 0.0.19

### Patch Changes

- c7499910: Revisit fragments if visited initially with `@defer`

  Fragments visited previously with `@defer` have not been added to the initial group field set, and so must be added.

  See: https://github.com/robrichard/defer-stream-wg/discussions/29#discussioncomment-2099307

## 0.0.18

### Patch Changes

- 3a842842: Changes to methods

  Simplifies methods, removing methods that were added merely for their potential as hooks.
  Any actually needed hooks can be restored upon request.
  Renames several methods for clarity.
  Note that all Executor class methods are still considered internal.

## 0.0.17

### Patch Changes

- 53a698e2: preserve key order when promises resolves out of order

## 0.0.16

### Patch Changes

- 2a1621cb: Streamline/refactor Executor methods and arguments

## 0.0.15

### Patch Changes

- 672a7433: use enableIncremental instead of disableIncremental

  with default of true rather than of false.

  enable-type option flags may be easier to reason about.

- 6b973083: refactor toExecutorSchema to add only necessary input types

## 0.0.14

### Patch Changes

- 01118639: Fix ExecutorSchema isNonNullType method

  Client documents may wrap input types with non-nullable wrapper types not present in the schema. The ExecutorSchema should recognize these non-nullable types as such.

## 0.0.13

### Patch Changes

- 6151cdbf: Add all valid input types to ExecutorSchema

  Variables can define ad-hoc input types not present in schema by adding non-null wrappers.

## 0.0.12

### Patch Changes

- d93aa9a2: Add graphql-js v14 support
- 832b8afb: Introduce the `ExecutorSchema` interface

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

- ac0430a1: remove createSourceEventStream function export

  BREAKING CHANGE: access to createSourceEventStream is still possible in advanced cases, but now only via an explicitly created instance of the internal Executor class.

- d06133c6: Skip schema validation prior to first use.

  Schemas can (and should!) still be validated when and where appropriate using the dedicated graphql-js validateSchema method.

  graphql-js validates previously unvalidated schemas prior to the first execution. The validation step is skipped by graphql-js if and only if the schema was created with the `assumeValid` option, which essentially triggers a faux validation run that produces no errors.

  graphql-executor now simply does not automatically validate schemas, preferring to require servers to explicitly validate schemas when and where appropriate, just as document validation is a distinct, explicit step.

- ecc37585: Allow cross-realm execution

  This is made possible by avoiding instanceof checks within the executor proper.

  New predicates are introduced that rely on Symbol.toStringTag (or error names) to identify objects from other realms.

  Field/type resolvers and isTypeOf functions that are passed GraphQL type system entities and use native graphql-js predicates will still encounter cross-realm errors.

  Cross-realm execution can be avoided by end-users by simply calling the original isSchema predicate from graphql-js.

## 0.0.11

### Patch Changes

- c598a401: Release latest upstream incremental delivery changes

  At most recent working group, decisions were made (1) to throw field errors on negative "initialCount" arguments to the "stream" directive, (2) to forbid deferral of non-Query root fields.

  Implementation of disabling of incremental delivery is done upstream on schema creation, we continue to use the disableIncremental argument on execution, as `graphql-executor` does not manage schema creation.

## 0.0.10

### Patch Changes

- 5a9c3be1: Update README.md to reflect integration of execute and subscribe

## 0.0.9

### Patch Changes

- 797ee218: Memoize field lists created by the collectFields utility function.

  This allows functions that operate on these field lists to be memoized.

- 79440e60: Re-implement incremental delivery using repeaters.

  See https://repeater.js.org/ for further discussion about repeaters. This avoids bespoke raw async iterator and promise racing implementations.

- 3bd508de: Refactor flattenAsyncIterator to use a Repeater implementation

  This is also breaking change as the generator returned by flattenAsyncIterator will now (correctly) not support concurrent next() and throw() calls. As the generator returned by calls to execute should rarely be used with throw(), this breaking change should have little impact.

- 6bb42abe: Refactor mapAsyncIterator to use a Repeater implementation

  This is a breaking change as the generator returned by mapAsyncIterator will now (correctly) not support concurrent next() and throw() calls. As the generator returned by calls to execute should rarely be used with throw(), this breaking change should have little impact.

- f6d0b735: Support incremental delivery with defer/stream directives

  Port of https://github.com/graphql/graphql-js/pull/2839
  defer/stream support is enabled by default, but can be disabled using the `disableIncremental` argument.

- 7aaffa24: BREAKING CHANGE: `execute` now executes subscriptions as subscriptions, not queries, unless the new `forceQueryAlgorithm` option is set to true. The `subscribe` function has been removed.

  Executing a subscription with improper arguments now throws an error (rather than returning a promise that rejects with an error), aligning execution of subscriptions to that of queries and mutations.

## 0.0.8

### Patch Changes

- 8df89b5a: Allow list field resolvers to return async iterables

  https://github.com/graphql/graphql-js/pull/2757

## 0.0.7

### Patch Changes

- 61885391: Use custom Promise.all implementation

  The GraphQL specification allows fields and list items to execute in parallel (except the root fields of a mutation operation). Node.JS does not actually allow true parallel threads of execution, but it can approach the performance benefit using asynchronous code and the event loop. In practice, returning a result containing asynchronous work uses the built in Node.JS Promise.all method, which awaits the results of all pending work prior to returning.

  In a case where completion of a field or list item value errors (i.e. the resolver returned an error, and the field or list item value is not nullable), the current implementation exits early, as only one error is returned to the client per field, as per the spec. This can lead to undetectable long-running promises on the server. The new implementation waits for all promises to settle, but does not use Promise.allSettled, in order to ensure that the first error to occur is always returned, even if there are multiple errors. See also https://github.com/graphql/graphql-js/issues/2974

  On success, the new implementation also modifies the existing object, rather than returning a new object, in order to improve performance.

- 4e571e76: Switch graphql-js to peer dependency

## 0.0.6

### Patch Changes

- 43faf000: Update dependencies.

## 0.0.5

### Patch Changes

- 604d9282: Re-export execution functions

  `graphql-executor` previously allowed for execution pipeline customization by subclassing the exported Executor function. However, the existence of `graphql-executor` as a "safe," "smart" fork of `graphql-js` also allows for customization of the execution pipeline by simply forking `graphql-executor`, customizing, and using the `execute` and `subscribe` functions. These functions are now exported for that purpose. See the updated package README for further discussion.

## 0.0.4

### Patch Changes

- 80169543: Add GraphQL v15 to supported versions
- 80169543: Add changesets for workflow management
