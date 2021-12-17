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
} from './type/index.mjs';
/** Execute GraphQL queries. */

export {
  Executor,
  defaultFieldResolver,
  defaultTypeResolver,
  execute,
  executeSync,
  createSourceEventStream,
} from './execution/index.mjs';
/** Operate on GraphQL errors. */

export { isGraphQLError } from './error/index.mjs';
