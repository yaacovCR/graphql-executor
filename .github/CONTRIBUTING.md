# Contributing to graphql-executor

We want to make contributing to this project as easy and transparent as
possible. Hopefully this document makes the process for contributing clear and
answers any questions you may have. If not, feel free to open an
[Issue](https://github.com/graphql/graphql-spec/issues/).

## Issues

We use GitHub issues to track public bugs and requests. Please ensure your bug
description is clear and has sufficient instructions to be able to reproduce the
issue. The best way is to provide a reduced test case on jsFiddle or jsBin.

## Pull Requests

All active development of graphql-executor happens on GitHub. We actively welcome
your [pull requests](https://help.github.com/articles/creating-a-pull-request).

### Considered Changes

Like graphql-js, graphql-executor is
[GraphQL spec](https://graphql.github.io/graphql-spec/) compliant, so only changes
which comply with this spec will be considered. If you have a change in mind which
requires a change to the spec, please first open an
[issue](https://github.com/graphql/graphql-spec/issues/) against the spec.

### Getting Started

1. Fork this repo by using the "Fork" button in the upper-right

2. Check out your fork

   ```sh
   git clone git@github.com:your_name_here/graphql-executor.git
   ```

3. Install or Update all dependencies

   ```sh
   npm install
   ```

4. Get coding! If you've added code, add tests. If you've changed APIs, update
   any relevant documentation or tests. Ensure your work is committed within a
   feature branch.

5. Ensure all tests pass

   ```sh
   npm test
   ```

## Coding Style

Like graphql-js, this project uses [Prettier](https://prettier.io/) for standard
formatting. To ensure your pull request matches the style guides, run
`npm run prettier`.

- 2 spaces for indentation (no tabs)
- 80 character line length strongly preferred.
- Prefer `'` over `"`
- ES6 syntax when possible. However do not rely on ES6-specific functions to be available.
- Use [TypeScript](https://www.typescriptlang.org).
- Use semicolons;
- Trailing commas,
- Avd abbr wrds.

## License

By contributing to graphql-executor, you agree that your contributions will be
licensed under its [MIT license](../LICENSE).
