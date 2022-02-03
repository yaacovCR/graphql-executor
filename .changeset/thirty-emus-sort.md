---
'graphql-executor': patch
---

Changes to methods

Simplifies methods, removing methods that were added merely for their potential as hooks.
Any actually needed hooks can be restored upon request.
Renames several methods for clarity.
Note that all Executor class methods are still considered internal.
