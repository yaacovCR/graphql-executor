# graphql-executor

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
