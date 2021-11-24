# graphql-executor

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
