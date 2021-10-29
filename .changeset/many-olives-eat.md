---
'graphql-executor': patch
---

Support incremental delivery with defer/stream directives

Port of https://github.com/graphql/graphql-js/pull/2839
defer/stream support is enabled by default, but can be disabled using the `disableIncremental` argument.
