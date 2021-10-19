# graphql-executor

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
