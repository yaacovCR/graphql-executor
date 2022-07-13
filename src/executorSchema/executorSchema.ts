import type {
  FieldNode,
  FragmentDefinitionNode,
  GraphQLSchema,
  OperationDefinitionNode,
  OperationTypeNode,
  TypeNode,
  ValueNode,
} from 'graphql';

import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import type { Path } from '../jsutils/Path';

export enum DirectiveLocation {
  /** Request Definitions */
  QUERY = 'QUERY',
  MUTATION = 'MUTATION',
  SUBSCRIPTION = 'SUBSCRIPTION',
  FIELD = 'FIELD',
  FRAGMENT_DEFINITION = 'FRAGMENT_DEFINITION',
  FRAGMENT_SPREAD = 'FRAGMENT_SPREAD',
  INLINE_FRAGMENT = 'INLINE_FRAGMENT',
  VARIABLE_DEFINITION = 'VARIABLE_DEFINITION',
  /** Type System Definitions */
  SCHEMA = 'SCHEMA',
  SCALAR = 'SCALAR',
  OBJECT = 'OBJECT',
  FIELD_DEFINITION = 'FIELD_DEFINITION',
  ARGUMENT_DEFINITION = 'ARGUMENT_DEFINITION',
  INTERFACE = 'INTERFACE',
  UNION = 'UNION',
  ENUM = 'ENUM',
  ENUM_VALUE = 'ENUM_VALUE',
  INPUT_OBJECT = 'INPUT_OBJECT',
  INPUT_FIELD_DEFINITION = 'INPUT_FIELD_DEFINITION',
}
export interface Directive {
  name: string;
  description?: string;
  locations: ReadonlyArray<DirectiveLocation>;
  args: ReadonlyArray<Argument>;
  isRepeatable?: boolean;

  toString: () => string;
}

export type Type = NamedType | WrappingType;

export type NullableInputType = NamedInputType | List<InputType>;

export type InputType = NullableInputType | NonNull<NullableInputType>;

export type NullableOutputType = NamedOutputType | List<OutputType>;

export type OutputType = NullableOutputType | NonNull<NullableOutputType>;

export type LeafType = ScalarType | EnumType;

export type CompositeType = ObjectType | InterfaceType | UnionType;

export type AbstractType = InterfaceType | UnionType;

export interface List<T extends Type> {
  readonly ofType: T;

  toString: () => string;
}

export interface NonNull<T extends NullableType> {
  readonly ofType: T;

  toString: () => string;
}

export class ListImpl<T extends Type> {
  readonly ofType: T;

  constructor(ofType: T) {
    this.ofType = ofType;
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLList';
  }

  toString(): string {
    return '[' + String(this.ofType) + ']';
  }
}

export class NonNullImpl<T extends NullableType> {
  readonly ofType: T;

  constructor(ofType: T) {
    this.ofType = ofType;
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLNonNull';
  }

  toString(): string {
    return String(this.ofType) + '!';
  }
}

export type WrappingType = List<Type> | NonNull<NullableType>;

export type NullableType = NamedType | List<Type>;

export type NamedType = NamedInputType | NamedOutputType;

export type NamedInputType = ScalarType | EnumType | InputObjectType;

export type NamedOutputType =
  | ScalarType
  | ObjectType
  | InterfaceType
  | UnionType
  | EnumType;

export interface ScalarType<TInternal = unknown, TExternal = TInternal> {
  name: string;
  description?: string;
  specifiedByURL?: string;
  serialize: ScalarSerializer<TExternal>;
  parseValue: ScalarValueParser<TInternal>;
  parseLiteral: ScalarLiteralParser<TInternal>;

  toString: () => string;
}

export type ScalarSerializer<TExternal> = (outputValue: unknown) => TExternal;

export type ScalarValueParser<TInternal> = (inputValue: unknown) => TInternal;

export type ScalarLiteralParser<TInternal> = (
  valueNode: ValueNode,
  variables?: Maybe<ObjMap<unknown>>,
) => TInternal;

export interface ObjectType<TSource = any, TContext = any> {
  name: string;
  description?: string;
  isTypeOf?: IsTypeOfFn<TSource, TContext>;

  getFields: () => FieldMap<TSource, TContext>;

  getInterfaces: () => ReadonlyArray<InterfaceType>;

  toString: () => string;
}

export type TypeResolver<TSource, TContext> = (
  value: TSource,
  context: TContext,
  info: ResolveInfo,
  abstractType: AbstractType,
) => PromiseOrValue<string | undefined>;

export type IsTypeOfFn<TSource, TContext> = (
  source: TSource,
  context: TContext,
  info: ResolveInfo,
) => PromiseOrValue<boolean>;

export type FieldResolver<TSource, TContext, TArgs = any, TResult = unknown> = (
  source: TSource,
  args: TArgs,
  context: TContext,
  info: ResolveInfo,
) => TResult;

export interface ResolveInfo {
  readonly fieldName: string;
  readonly fieldNodes: ReadonlyArray<FieldNode>;
  readonly returnType: OutputType;
  readonly parentType: ObjectType;
  readonly path: Path;
  readonly schema: GraphQLSchema;
  readonly executorSchema: ExecutorSchema;
  readonly fragments: ObjMap<FragmentDefinitionNode>;
  readonly rootValue: unknown;
  readonly operation: OperationDefinitionNode;
  readonly variableValues: { [variable: string]: unknown };
}

export interface Field<TSource, TContext, TArgs = any> {
  name: string;
  description?: string;
  type: OutputType;
  args: ReadonlyArray<Argument>;
  resolve?: FieldResolver<TSource, TContext, TArgs>;
  subscribe?: FieldResolver<TSource, TContext, TArgs>;
  deprecationReason?: string;
}

export interface Argument {
  name: string;
  description?: string;
  type: InputType;
  defaultValue?: unknown;
  deprecationReason?: string;
}

export type FieldMap<TSource, TContext> = ObjMap<Field<TSource, TContext>>;

export interface InterfaceType {
  name: string;
  description?: string;
  resolveType?: TypeResolver<any, any>;

  getFields: () => FieldMap<any, any>;

  getInterfaces: () => ReadonlyArray<InterfaceType>;

  toString: () => string;
}

export interface UnionType {
  name: string;
  description?: string;
  resolveType?: TypeResolver<any, any>;

  getTypes: () => ReadonlyArray<ObjectType>;

  toString: () => string;
}

export interface EnumType /* <T> */ {
  name: string;
  description?: string;

  getValues: () => ReadonlyArray<EnumValue /* <T> */>;

  getValue: (name: string) => Maybe<EnumValue>;

  serialize: (outputValue: unknown /* T */) => Maybe<string>;
  parseValue: (inputValue: unknown) => Maybe<any>;
  parseLiteral: (
    valueNode: ValueNode,
    _variables: Maybe<ObjMap<unknown>>,
  ) => Maybe<any>;
  toString: () => string;
}

export interface EnumValue {
  name: string;
  description?: string;
  value: any /* T */;
  deprecationReason?: string;
}

export interface InputObjectType {
  name: string;
  description?: string;

  getFields: () => InputFieldMap;

  toString: () => string;
}

export interface InputField {
  name: string;
  description?: string;
  type: InputType;
  defaultValue: unknown;
  deprecationReason?: string;
}

export type InputFieldMap = ObjMap<InputField>;

export interface ExecutorSchema {
  description: Maybe<string>;
  isListType: ((type: InputType) => type is List<InputType>) &
    ((type: OutputType) => type is List<OutputType>) &
    ((type: unknown) => type is List<Type>);
  isNonNullType: ((type: InputType) => type is NonNull<NullableInputType>) &
    ((type: OutputType) => type is NonNull<NullableOutputType>) &
    ((type: unknown) => type is NonNull<NullableType>);
  isNamedType: (type: unknown) => type is NamedType;
  isInputType: (type: unknown) => type is InputType;
  isLeafType: (type: unknown) => type is LeafType;
  isScalarType: (type: unknown) => type is ScalarType;
  isEnumType: (type: unknown) => type is EnumType;
  isAbstractType: (type: unknown) => type is AbstractType;
  isInterfaceType: (type: unknown) => type is InterfaceType;
  isUnionType: (type: unknown) => type is UnionType;
  isObjectType: (type: unknown) => type is ObjectType;
  isInputObjectType: (type: unknown) => type is InputObjectType;
  getDirectives: () => ReadonlyArray<Directive>;
  getDirective: (directiveName: string) => Directive | undefined;
  getNamedTypes: () => ReadonlyArray<NamedType>;
  getNamedType: (typeName: string) => NamedType | undefined;
  getType: (typeNode: TypeNode) => Type | undefined;
  getRootType: (operation: OperationTypeNode) => ObjectType | undefined;
  getPossibleTypes: (abstractType: AbstractType) => ReadonlyArray<ObjectType>;
  isSubType: (
    abstractType: AbstractType,
    maybeSubType: ObjectType | InterfaceType,
  ) => boolean;
}
