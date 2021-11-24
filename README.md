# GraphQL Executor

A customizable GraphQL Spec compliant Executor based on [graphql-js](https://github.com/graphql/graphql-js/)

### Installation

With npm:

```sh
npm install --save graphql-executor
```

or using yarn:

```sh
yarn add graphql-executor
```

### Usage

For the default GraphQL-Executor behavior:

1. Use the `execute` and `subscribe` methods exported by `graphql-executor` in place of those exported by `graphql-js`.

To customize execution:
(A) fork this package, customize the code, and carry on as above, or
(B) override the internal `Executor` class:

1. Remember to pin the version of `graphql-executor` you use, as the `Executor` class remains internal with all changes considered non-breaking.
2. Subclass the exported `Executor` class.
3. Override your subclassed `Executor` methods as desired to provide your custom functionality.
4. Create a new custom `execute` function calling this subclass.

```ts
import { Executor } from 'graphql-executor';

class MyCustomExecutor extends Executor {
  // ...
}

export function execute(args: ExecutionArgs): PromiseOrValue<ExecutionResult> {
  const executor = new MyCustomExecutor(args);
  return executor.executeQueryOrMutation(args);
}
```

### Why GraphQL Executor?

GraphQL Executor provides:

1. A way to fork the GraphQL.JS executor without introducing multiple versions of
   `graphql-js` into your project. `graphql-executor` is a "smart" fork of only the
   `execution` module of `graphql-js`. You can safely fork `graphql-executor` to
   customize your execution flow as needed.
2. A code-only method of customizing the executor by subclassing the exported internal
   `Executor` class as above.
3. Direct benefits from our own customizations! GraphQL Executor is spec-compliant,
   but also supports experimental features (such as `@defer`/`@stream` support) and provide
   other improvements as possible. See (https://github.com/yaacovCR/graphql-executor/releases)
   to track any new features.

### The Long Version

[GraphQL.js](https://github.com/graphql/graphql-js) occupies a foundational position
within the Javascript GraphQL ecosystem as the central dependency for almost all other
community packages. GraphQL.js provides two key capabilities: building a typed schema
and executing requests against that type schema; it also includes a parser for the
GraphQL language and a handful of additional extremely helpful utilities. The vast
majority of community packages depend in some way upon this bedrock to provide all
additional custom functionality.

GraphQL.js allows for customization in several ways. SDL directives allow schema
and operation writers to specify custom behavior while still using the standard GraphQL
parser. `extensions` fields on most objects allow for setting and passing custom
metadata. In many ways, execution can be customized within resolver functions, perhaps
in combination with the above custom directives and extensions.

Customization of the execution algorithm itself is less straightforward, if not
impossible. GraphQL.js serves as a reference implementation for the
[GraphQL specification](https://spec.graphql.org/). This means that the execution
algorithm included within GraphQL.js is designed not only to be spec-compliant, but
also to most clearly express the algorithms contained within the spec. While
experimentation is encouraged, this is in the context of pull requests to the
specification, which should have a matching pull request within the reference
implementation. Execution algorithm customization is not the main concern of
GraphQL.js, and is usually therefore handled to the extent possible outside the
execution pipeline within the calling code.

For example, take note of [Envelop](https://www.envelop.dev/), a powerful,
server-agnostic method of customizing the GraphQL request layer. Note that the
[available execution hooks](https://www.envelop.dev/docs/plugins/lifecycle#onexecuteapi)
are limited to `onExecuteDone` and `onResolverCalled`, among a few others.
GraphQL.JS provides a hook for field resolution, but not for field completion,
for example, limiting the hooks that Envelop can provide. Free-form user customization
of execution cuts against the role of GraphQL.JS as a strict, spec-conformant reference
implementation. Introduction of middleware in GraphQL.JS [has](https://github.com/graphql/graphql-js/issues/109)
[proved](https://github.com/graphql/graphql-js/issues/1516)
[elusive](https://github.com/graphql/graphql-js/issues/3163).

GraphQL Executor fills this gap by allowing for customization of the entire execution
pipeline. Perhaps the most straightforward method of customizing execution would be to
simply fork the `graphql-js` package for one's own custom use. This is made difficult by
the central position of GraphQL.js in the ecosystem; most projects can safely tolerate
only a single version of `graphql-js`, see
[graphql-js#594](https://github.com/graphql/graphql-js/issues/594) and
["GraphQL.js: Preparing for v14.0.0"](https://medium.com/@leeb/graphql-js-preparing-for-v14-0-0-839f823c144e).

GraphQL Executor is a "smartly" forked version of the `graphql.js` package that includes
only the `execution` module and still depends on the `graphql-js` package for all other
purposes, thereby eliding the issues above.

GraphQL Executor also refactors the execution pipeline from GraphQL.js into an exported
versioned, an `Executor` class. An `execute` function is simply a thin wrapper around
the `Executor.executeQueryOrMutation(args)` and `Executor.executeSubscription(args)`
methods. You can subclass the `Executor` class to customize the executor pipeline without
maintaining a separate repository. The `Executor` class is internal, so when utilizing this
method, you must pin the version of the `graphql-executor` package.

### Contributing

We actively welcome pull requests. GraphQL Executor is spec-compliant but is open to adopting
experimental behavior (such as the already supported `@defer`/`@stream` directives).

### Changelog

We use [`changesets`](https://github.com/atlassian/changesets) for release management.
Changes are therefore tracked as [GitHub releases](https://github.com/yaacovCR/graphql-executor/releases).

### License

GraphQL Executor is [MIT-licensed](./LICENSE).

### Credits

Credit for GraphQL Executor is due mostly to all the hard work done at
[graphql-js](https://github.com/graphql/graphql-js), and especially @IvanGoncharov, who
provided close direction and guidance for this method of customizing execution.
