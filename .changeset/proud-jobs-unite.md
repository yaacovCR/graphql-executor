---
'graphql-executor': patch
---

Release latest upstream incremental delivery changes

At most recent working group, decisions were made (1) to throw field errors on negative "initialCount" arguments to the "stream" directive, (2) to forbid deferral of non-Query root fields.

Implementation of disabling of incremental delivery is done upstream on schema creation, we continue to use the disableIncremental argument on execution, as `graphql-executor` does not manage schema creation.
