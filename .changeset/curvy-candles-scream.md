---
'graphql-executor': patch
---

Re-export execution functions

`graphql-executor` previously allowed for execution pipeline customization by subclassing the exported Executor function. However, the existence of `graphql-executor` as a "safe," "smart" fork of `graphql-js` also allows for customization of the execution pipeline by simply forking `graphql-executor`, customizing, and using the `execute` and `subscribe` functions. These functions are now exported for that purpose. See the updated package README for further discussion.
