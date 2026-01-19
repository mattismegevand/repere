/**
 * Filter Expression Parser
 *
 * Parses SQL-like filter syntax into FilterExpression objects.
 *
 * Syntax examples:
 *   status = "active"
 *   priority > 3
 *   name CONTAINS "john"
 *   category IN ["A", "B"]
 *   price BETWEEN 10 AND 100
 *   status = "active" AND priority > 3
 *   (a = 1 OR b = 2) AND c = 3
 */

import type { Filter, FilterCondition, FilterExpression, FilterOperator } from '@/types'

export interface ParseError {
  message: string
  position: number
  length: number
}

export interface ParseResult {
  success: boolean
  expression?: FilterExpression
  errors: ParseError[]
}

type TokenType =
  | 'IDENTIFIER'
  | 'STRING'
  | 'NUMBER'
  | 'NULL'
  | 'TRUE'
  | 'FALSE'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'IN'
  | 'BETWEEN'
  | 'IS'
  | 'CONTAINS'
  | 'STARTS'
  | 'ENDS'
  | 'EQ'
  | 'NEQ'
  | 'GT'
  | 'LT'
  | 'GTE'
  | 'LTE'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COMMA'
  | 'EOF'

interface Token {
  type: TokenType
  value: string
  position: number
  length: number
}

const KEYWORDS: Record<string, TokenType> = {
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  IN: 'IN',
  BETWEEN: 'BETWEEN',
  IS: 'IS',
  NULL: 'NULL',
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  CONTAINS: 'CONTAINS',
  STARTS: 'STARTS',
  ENDS: 'ENDS',
}

class Lexer {
  private input: string
  private pos: number = 0
  private tokens: Token[] = []
  errors: ParseError[] = []

  constructor(input: string) {
    this.input = input
  }

  tokenize(): Token[] {
    while (this.pos < this.input.length) {
      this.skipWhitespace()
      if (this.pos >= this.input.length) break

      const char = this.input[this.pos]

      if (char === '(') {
        this.addToken('LPAREN', '(')
        continue
      }
      if (char === ')') {
        this.addToken('RPAREN', ')')
        continue
      }
      if (char === '[') {
        this.addToken('LBRACKET', '[')
        continue
      }
      if (char === ']') {
        this.addToken('RBRACKET', ']')
        continue
      }
      if (char === ',') {
        this.addToken('COMMA', ',')
        continue
      }

      if (char === '=' && this.peek() === '=') {
        this.addToken('EQ', '==', 2)
        continue
      }
      if (char === '=') {
        this.addToken('EQ', '=')
        continue
      }
      if (char === '!' && this.peek() === '=') {
        this.addToken('NEQ', '!=', 2)
        continue
      }
      if (char === '<' && this.peek() === '>') {
        this.addToken('NEQ', '<>', 2)
        continue
      }
      if (char === '>' && this.peek() === '=') {
        this.addToken('GTE', '>=', 2)
        continue
      }
      if (char === '<' && this.peek() === '=') {
        this.addToken('LTE', '<=', 2)
        continue
      }
      if (char === '>') {
        this.addToken('GT', '>')
        continue
      }
      if (char === '<') {
        this.addToken('LT', '<')
        continue
      }

      if (char === '"' || char === "'") {
        this.readString(char)
        continue
      }

      if (this.isDigit(char) || (char === '-' && this.isDigit(this.peek()))) {
        this.readNumber()
        continue
      }

      if (this.isIdentifierStart(char)) {
        this.readIdentifier()
        continue
      }

      this.errors.push({
        message: `Unexpected character: ${char}`,
        position: this.pos,
        length: 1,
      })
      this.pos++
    }

    this.tokens.push({ type: 'EOF', value: '', position: this.pos, length: 0 })
    return this.tokens
  }

  private skipWhitespace() {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++
    }
  }

  private peek(): string {
    return this.pos + 1 < this.input.length ? this.input[this.pos + 1] : ''
  }

  private addToken(type: TokenType, value: string, len: number = 1) {
    this.tokens.push({ type, value, position: this.pos, length: len })
    this.pos += len
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char)
  }

  private isIdentifierStart(char: string): boolean {
    return /[a-zA-Z_]/.test(char)
  }

  private isIdentifierChar(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char)
  }

  private readString(quote: string) {
    const start = this.pos
    this.pos++ // skip opening quote
    let value = ''

    while (this.pos < this.input.length) {
      const char = this.input[this.pos]
      if (char === quote) {
        this.pos++ // skip closing quote
        this.tokens.push({ type: 'STRING', value, position: start, length: this.pos - start })
        return
      }
      if (char === '\\' && this.pos + 1 < this.input.length) {
        this.pos++
        const escaped = this.input[this.pos]
        if (escaped === 'n') value += '\n'
        else if (escaped === 't') value += '\t'
        else if (escaped === '\\') value += '\\'
        else if (escaped === quote) value += quote
        else value += escaped
        this.pos++
      } else {
        value += char
        this.pos++
      }
    }

    this.errors.push({
      message: 'Unterminated string',
      position: start,
      length: this.pos - start,
    })
    this.tokens.push({ type: 'STRING', value, position: start, length: this.pos - start })
  }

  private readNumber() {
    const start = this.pos
    let value = ''

    if (this.input[this.pos] === '-') {
      value += '-'
      this.pos++
    }

    while (this.pos < this.input.length && this.isDigit(this.input[this.pos])) {
      value += this.input[this.pos]
      this.pos++
    }

    if (this.input[this.pos] === '.' && this.isDigit(this.peek())) {
      value += '.'
      this.pos++
      while (this.pos < this.input.length && this.isDigit(this.input[this.pos])) {
        value += this.input[this.pos]
        this.pos++
      }
    }

    this.tokens.push({ type: 'NUMBER', value, position: start, length: this.pos - start })
  }

  private readIdentifier() {
    const start = this.pos
    let value = ''

    while (this.pos < this.input.length && this.isIdentifierChar(this.input[this.pos])) {
      value += this.input[this.pos]
      this.pos++
    }

    const upper = value.toUpperCase()
    const tokenType = KEYWORDS[upper] ?? 'IDENTIFIER'
    this.tokens.push({ type: tokenType, value, position: start, length: this.pos - start })
  }
}

class Parser {
  private tokens: Token[]
  private pos: number = 0
  errors: ParseError[] = []

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  parse(): FilterExpression | null {
    try {
      const expr = this.parseExpression()
      if (!this.isAtEnd()) {
        this.error(`Unexpected token: ${this.current().value}`)
      }
      return expr
    } catch {
      return null
    }
  }

  private parseExpression(): FilterExpression {
    return this.parseOr()
  }

  private parseOr(): FilterExpression {
    let left = this.parseAnd()

    while (this.match('OR')) {
      const right = this.parseAnd()
      // Combine into OR group
      if (left.type === 'group' && left.combineMode === 'or') {
        left.children.push(right)
      } else {
        left = {
          type: 'group',
          combineMode: 'or',
          children: [left, right],
        }
      }
    }

    return left
  }

  private parseAnd(): FilterExpression {
    let left = this.parsePrimary()

    while (this.match('AND')) {
      const right = this.parsePrimary()
      // Combine into AND group
      if (left.type === 'group' && left.combineMode === 'and') {
        left.children.push(right)
      } else {
        left = {
          type: 'group',
          combineMode: 'and',
          children: [left, right],
        }
      }
    }

    return left
  }

  private parsePrimary(): FilterExpression {
    if (this.match('LPAREN')) {
      const expr = this.parseExpression()
      this.expect('RPAREN', 'Expected closing parenthesis')
      return expr
    }

    return this.parseCondition()
  }

  private parseCondition(): FilterCondition {
    const column = this.expect('IDENTIFIER', 'Expected column name')

    // Check for IS NULL / IS NOT NULL
    if (this.match('IS')) {
      const notNull = this.match('NOT')
      this.expect('NULL', 'Expected NULL after IS')
      return {
        type: 'condition',
        filter: {
          column: column.value,
          operator: notNull ? 'isNotNull' : 'isNull',
          value: null,
        },
      }
    }

    // Check for NOT IN / NOT CONTAINS
    const hasNot = this.match('NOT')

    // Parse operator
    const { operator, needsSecondValue } = this.parseOperator(hasNot)

    // Parse value
    let value: unknown

    if (operator === 'between') {
      const val1 = this.parseValue()
      this.expect('AND', 'Expected AND in BETWEEN expression')
      const val2 = this.parseValue()
      value = [val1, val2]
    } else if (operator === 'in' || operator === 'notIn') {
      value = this.parseArray()
    } else if (needsSecondValue) {
      value = this.parseValue()
    } else {
      value = null
    }

    return {
      type: 'condition',
      filter: {
        column: column.value,
        operator,
        value,
      },
    }
  }

  private parseOperator(hasNot: boolean): { operator: FilterOperator; needsSecondValue: boolean } {
    if (this.match('EQ')) return { operator: 'eq', needsSecondValue: true }
    if (this.match('NEQ')) return { operator: 'neq', needsSecondValue: true }
    if (this.match('GT')) return { operator: 'gt', needsSecondValue: true }
    if (this.match('LT')) return { operator: 'lt', needsSecondValue: true }
    if (this.match('GTE')) return { operator: 'gte', needsSecondValue: true }
    if (this.match('LTE')) return { operator: 'lte', needsSecondValue: true }
    if (this.match('CONTAINS')) return { operator: hasNot ? 'notContains' : 'contains', needsSecondValue: true }
    if (this.match('STARTS')) return { operator: 'startsWith', needsSecondValue: true }
    if (this.match('ENDS')) return { operator: 'endsWith', needsSecondValue: true }
    if (this.match('IN')) return { operator: hasNot ? 'notIn' : 'in', needsSecondValue: true }
    if (this.match('BETWEEN')) return { operator: 'between', needsSecondValue: true }

    this.error('Expected operator')
    return { operator: 'eq', needsSecondValue: true }
  }

  private parseValue(): unknown {
    if (this.match('STRING')) {
      return this.previous().value
    }
    if (this.match('NUMBER')) {
      const val = this.previous().value
      return val.includes('.') ? parseFloat(val) : parseInt(val, 10)
    }
    if (this.match('TRUE')) {
      return true
    }
    if (this.match('FALSE')) {
      return false
    }
    if (this.match('NULL')) {
      return null
    }
    // Allow unquoted identifiers as string values
    if (this.check('IDENTIFIER')) {
      return this.advance().value
    }

    this.error('Expected value')
    return ''
  }

  private parseArray(): unknown[] {
    this.expect('LBRACKET', 'Expected [ for array')
    const values: unknown[] = []

    if (!this.check('RBRACKET')) {
      do {
        values.push(this.parseValue())
      } while (this.match('COMMA'))
    }

    this.expect('RBRACKET', 'Expected ] after array')
    return values
  }

  private current(): Token {
    return this.tokens[this.pos]
  }

  private previous(): Token {
    return this.tokens[this.pos - 1]
  }

  private isAtEnd(): boolean {
    return this.current().type === 'EOF'
  }

  private check(type: TokenType): boolean {
    return !this.isAtEnd() && this.current().type === type
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance()
        return true
      }
    }
    return false
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++
    return this.previous()
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance()
    this.error(message)
    return this.current()
  }

  private error(message: string): never {
    const token = this.current()
    this.errors.push({
      message,
      position: token.position,
      length: token.length || 1,
    })
    throw new Error(message)
  }
}

const OPERATOR_TEXT: Record<FilterOperator, string> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
  contains: 'CONTAINS',
  notContains: 'NOT CONTAINS',
  startsWith: 'STARTS',
  endsWith: 'ENDS',
  isNull: 'IS NULL',
  isNotNull: 'IS NOT NULL',
  in: 'IN',
  notIn: 'NOT IN',
  between: 'BETWEEN',
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    // Escape quotes and special chars
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return `"${escaped}"`
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatValue).join(', ')}]`
  }
  return String(value)
}

function formatCondition(filter: Filter): string {
  const { column, operator, value } = filter

  // Handle IS NULL / IS NOT NULL
  if (operator === 'isNull') return `${column} IS NULL`
  if (operator === 'isNotNull') return `${column} IS NOT NULL`

  // Handle BETWEEN
  if (operator === 'between' && Array.isArray(value)) {
    return `${column} BETWEEN ${formatValue(value[0])} AND ${formatValue(value[1])}`
  }

  // Handle IN / NOT IN
  if (operator === 'in' || operator === 'notIn') {
    const arr = Array.isArray(value) ? value : [value]
    return `${column} ${OPERATOR_TEXT[operator]} [${arr.map(formatValue).join(', ')}]`
  }

  // Standard operators
  return `${column} ${OPERATOR_TEXT[operator]} ${formatValue(value)}`
}

export function formatFilterExpression(expr: FilterExpression, depth: number = 0): string {
  if (expr.type === 'condition') {
    return formatCondition(expr.filter)
  }

  const children = expr.children.map((child) => {
    const formatted = formatFilterExpression(child, depth + 1)
    // Wrap child groups in parentheses if they have different combineMode
    if (child.type === 'group' && child.combineMode !== expr.combineMode) {
      return `(${formatted})`
    }
    return formatted
  })

  const connector = expr.combineMode === 'and' ? ' AND ' : ' OR '
  return children.join(connector)
}

export function parseFilterText(text: string): ParseResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { success: true, expression: undefined, errors: [] }
  }

  const lexer = new Lexer(trimmed)
  const tokens = lexer.tokenize()

  if (lexer.errors.length > 0) {
    return { success: false, errors: lexer.errors }
  }

  const parser = new Parser(tokens)
  const expression = parser.parse()

  if (parser.errors.length > 0) {
    return { success: false, errors: parser.errors }
  }

  return { success: true, expression: expression ?? undefined, errors: [] }
}

export function validateFilterText(text: string): ParseError[] {
  const result = parseFilterText(text)
  return result.errors
}
