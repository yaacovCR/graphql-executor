# GraphQL Executor

A customizable GraphQL Spec compliant Executor class based on [graphql-js](https://github.com/graphql/graphql-js/)

See more complete documentation at https://graphql.org/ and
https://graphql.org/graphql-js/.

Looking for help? Find resources [from the community](https://graphql.org/community/).

### Installation

With npm:

```sh
npm install --save graphql-executor
```

or using yarn:

```sh
yarn add graphql-executor
```

GraphQL.js provides two important capabilities: building a typed schema and
executing requests against that type schema.

GraphQL Executor refactors the execution pipeline from GraphQL.js into an exported
versioned, an `Executor` class. An `execute` function is simply a thin wrapper around
the `Executor.executeQueryOrMutation(args)` and `Executor.executeSubscription(args)`
methods.

To customize execution:

1. Subclass the `Executor` class.
2. Override `Executor` methods as desired to provide your custom functionality.
3. Create a new custom `execute` function calling this subclass.

```ts
export function execute(args: ExecutionArgs): PromiseOrValue<ExecutionResult> {
  const executor = new MyCustomExecutor(args);
  return executor.executeQueryOrMutation(args);
}
```

### Want to ride the bleeding edge?

The `npm` branch in this repository is automatically maintained to be the last
commit to `main` to pass all tests, in the same form found on npm. It is
recommended to use builds deployed to npm for many reasons, but if you want to use
the latest not-yet-released version of `graphql-executor`, you can do so by depending
directly on this branch:

```
npm install graphql-executor@git://github.com/yaacovCR/graphql-executor.git#npm
```

### Using in a Browser

GraphQL Executor is a general-purpose library and can be used both in a Node server
and in the browser.

Building a project using GraphQL Executor with [webpack](https://webpack.js.org) or
[rollup](https://github.com/rollup/rollup) should just work and only include
the portions of the library you use. This works because GraphQL.js is distributed
with both CommonJS (`require()`) and ESModule (`import`) files. Ensure that any
custom build configurations look for `.mjs` files!

### Contributing

We actively welcome pull requests. GraphQL Executor is spec-compliant but is open to adopting
experimental behavior such as `@defer`/`@stream` support.

### Changelog

Changes are tracked as [GitHub releases](https://github.com/yaacovCR/graphql-executor/releases).

### License

GraphQL Executor is [MIT-licensed](./LICENSE).

### Credits

Credit for GraphQL Executor is due mostly to all the hard work done at
[graphql-js](https://github.com/graphql/graphql-js), and especially @IvanGoncharov, who
provided close direction and guidance for this method of customizing execution.
