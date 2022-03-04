---
'graphql-executor': patch
---

Revisit fragments if visited initially with `@defer`

Fragments visited previously with `@defer` have not been added to the initial group field set, and so must be added.

See: https://github.com/robrichard/defer-stream-wg/discussions/29#discussioncomment-2099307
