import type {
  InputType,
  List,
  NamedInputType,
  NonNull,
  NullableInputType,
} from './executorSchema';
import { ListImpl, NonNullImpl } from './executorSchema';

interface InputTypeInfo {
  nonNullListWrappers: Array<boolean>;
  nonNull: boolean;
  namedType: NamedInputType;
}

function getInputTypeInfo(
  isListType: (type: unknown) => type is List<any>,
  isNonNullType: (type: unknown) => type is NonNull<any>,
  type: InputType,
  wrapper?: NonNull<NullableInputType> | List<InputType>,
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
  inputType: InputType,
): Array<InputType> {
  return sequences.map((sequence) =>
    sequence.reduce((prev, nonNull) => {
      const wrapped = new ListImpl(prev);
      return nonNull ? new NonNullImpl(wrapped) : wrapped;
    }, inputType),
  );
}

export function getPossibleInputTypes(
  isListType: (type: unknown) => type is List<any>,
  isNonNullType: (type: unknown) => type is NonNull<any>,
  type: InputType,
): Array<InputType> {
  // See: https://github.com/yaacovCR/graphql-executor/issues/174
  // Unwrap any non-null modifier to the outermost type because a variable
  // on the outermost type can be nullable if a default value is supplied.
  // Non-null versions will then be allowed by the algorithm below as at all
  // levels.
  const nullableOuterType = isNonNullType(type) ? type.ofType : type;

  const { nonNullListWrappers, nonNull, namedType } = getInputTypeInfo(
    isListType,
    isNonNullType,
    nullableOuterType,
  );
  const sequences = getPossibleSequences(nonNullListWrappers);

  const wrapped = new NonNullImpl(namedType);
  if (nonNull) {
    return inputTypesFromSequences(sequences, wrapped);
  }

  return [
    ...inputTypesFromSequences(sequences, namedType),
    ...inputTypesFromSequences(sequences, wrapped),
  ];
}
