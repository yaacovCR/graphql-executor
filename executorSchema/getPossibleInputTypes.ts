import type { GraphQLNamedType, GraphQLInputType } from 'graphql';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import type { GraphQLNullableInputType } from './executorSchema.ts';
interface InputTypeInfo {
  nonNullListWrappers: Array<boolean>;
  nonNull: boolean;
  namedType: GraphQLNamedType & GraphQLInputType;
}

function getInputTypeInfo(
  isListType: (type: unknown) => type is GraphQLList<any>,
  isNonNullType: (type: unknown) => type is GraphQLNonNull<any>,
  type: GraphQLInputType,
  wrapper?:
    | GraphQLNonNull<GraphQLNullableInputType>
    | GraphQLList<GraphQLInputType>,
): InputTypeInfo {
  if (!isListType(type) && !isNonNullType(type)) {
    return {
      nonNullListWrappers: [],
      nonNull: isNonNullType(wrapper),
      namedType: type,
    };
  }

  const inputTypeInfo = getInputTypeInfo(
    isListType,
    isNonNullType,
    type.ofType,
    type,
  );

  if (isNonNullType(type)) {
    return inputTypeInfo;
  }

  inputTypeInfo.nonNullListWrappers.push(isNonNullType(wrapper));
  return inputTypeInfo;
}

function getPossibleSequences(
  nonNullListWrappers: Array<boolean>,
): Array<Array<boolean>> {
  if (!nonNullListWrappers.length) {
    return [[]];
  }

  const nonNull = nonNullListWrappers.pop();

  if (nonNull) {
    return getPossibleSequences(nonNullListWrappers).map((sequence) => [
      true,
      ...sequence,
    ]);
  }

  return [
    ...getPossibleSequences(nonNullListWrappers).map((sequence) => [
      true,
      ...sequence,
    ]),
    ...getPossibleSequences(nonNullListWrappers).map((sequence) => [
      false,
      ...sequence,
    ]),
  ];
}

function inputTypesFromSequences(
  sequences: Array<Array<boolean>>,
  inputType: GraphQLInputType,
): Array<GraphQLInputType> {
  return sequences.map((sequence) =>
    sequence.reduce((acc, nonNull) => {
      let wrapped = new GraphQLList(acc);

      if (nonNull) {
        wrapped = new GraphQLNonNull(wrapped);
      }

      return wrapped;
    }, inputType),
  );
}

export function getPossibleInputTypes(
  isListType: (type: unknown) => type is GraphQLList<any>,
  isNonNullType: (type: unknown) => type is GraphQLNonNull<any>,
  type: GraphQLInputType,
): Array<GraphQLInputType> {
  const { nonNullListWrappers, nonNull, namedType } = getInputTypeInfo(
    isListType,
    isNonNullType,
    type,
  );
  const sequences = getPossibleSequences(nonNullListWrappers);
  const wrapped = new GraphQLNonNull(namedType);

  if (nonNull) {
    return inputTypesFromSequences(sequences, wrapped);
  }

  return [
    ...inputTypesFromSequences(sequences, namedType),
    ...inputTypesFromSequences(sequences, wrapped),
  ];
}
