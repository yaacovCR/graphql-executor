import type { GraphQLInputType, ValueNode } from 'graphql';
import type { ObjMap } from '../jsutils/ObjMap';
import type { Maybe } from '../jsutils/Maybe';
import type { ExecutorSchema } from '../execution/executorSchema';
/**
 * Produces a JavaScript value given a GraphQL Value AST.
 *
 * A GraphQL type must be provided, which will be used to interpret different
 * GraphQL Value literals.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 *
 * | GraphQL Value        | JSON Value    |
 * | -------------------- | ------------- |
 * | Input Object         | Object        |
 * | List                 | Array         |
 * | Boolean              | Boolean       |
 * | String               | String        |
 * | Int / Float          | Number        |
 * | Enum Value           | Unknown       |
 * | NullValue            | null          |
 *
 */
export declare function valueFromAST(
  executorSchema: ExecutorSchema,
  valueNode: Maybe<ValueNode>,
  type: GraphQLInputType,
  variables?: Maybe<ObjMap<unknown>>,
): unknown;
