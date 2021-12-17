/** Operate on GraphQL type definitions and schema. */
export {
  /** Directives for defer/stream support */
  GraphQLDeferDirective,
  GraphQLStreamDirective,
  /** Predicates */
  isSchema,
  isScalarType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isInputType,
  isLeafType,
  isAbstractType,
  isWrappingType,
  /** Assertions */
  assertSchema,
} from './type/index.ts';
/** Execute GraphQL queries. */

export type { ExecutionArgs } from './execution/index.ts';
export {
  Executor,
  defaultFieldResolver,
  defaultTypeResolver,
  execute,
  executeSync,
  createSourceEventStream,
} from './execution/index.ts';
/** Operate on GraphQL errors. */

export { isGraphQLError } from './error/index.ts';
