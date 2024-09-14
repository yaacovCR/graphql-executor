/**
 * An exported enum describing the different kinds of tokens that the
 * lexer emits.
 */
enum TokenKind {
  SOF = '<SOF>',
  EOF = '<EOF>',
  BANG = '!',
  ASTERISK = '*',
  DOLLAR = '$',
  AMP = '&',
  PAREN_L = '(',
  PAREN_R = ')',
  SPREAD = '...',
  COLON = ':',
  EQUALS = '=',
  AT = '@',
  BRACKET_L = '[',
  BRACKET_R = ']',
  BRACE_L = '{',
  PIPE = '|',
  BRACE_R = '}',
  NAME = 'Name',
  INT = 'Int',
  FLOAT = 'Float',
  STRING = 'String',
  BLOCK_STRING = 'BlockString',
  COMMENT = 'Comment',
}
export { TokenKind };

/**
 * The enum type representing the token kinds values.
 *
 * @deprecated Please use `TokenKind`. Will be remove in v17.
 */
export type TokenKindEnum = typeof TokenKind;
