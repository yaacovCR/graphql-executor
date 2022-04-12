---
'graphql-executor': patch
---

Always include nullable outermost input type within schema

Because variables could include a default value.

See https://github.com/yaacovCR/graphql-executor/issues/174 for more details.
