/**
 * @module formula-parser
 * 公式词法分析与语法解析模块
 */

const CELL_PATTERN = /^[A-Z]+\d+$/
const IDENTIFIER_PATTERN = /^[a-zA-Z_]\w*$/
const OPERATORS = new Set(['+', '-', '*', '/'])

const TOKEN_TYPES = {
  NUMBER: 'NUMBER',
  CELL_REF: 'CELL_REF',
  IDENTIFIER: 'IDENTIFIER',
  OPERATOR: 'OPERATOR',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  COMMA: 'COMMA',
  COLON: 'COLON',
  EOF: 'EOF'
}

/**
 * Token 词法单元
 * @typedef {Object} Token
 * @property {string} type - Token 类型
 * @property {string|number|null} value - Token 值
 * @property {number} position - 在原始字符串中的位置
 */

class Token {
  /**
   * @param {string} type
   * @param {string|number|null} value
   * @param {number} position
   */
  constructor(type, value, position) {
    this.type = type
    this.value = value
    this.position = position
  }

  toString() {
    return `Token(${this.type}, "${this.value}", pos=${this.position})`
  }
}

/**
 * 公式语法错误
 */
export class FormulaSyntaxError extends Error {
  /**
   * @param {string} message - 错误信息
   * @param {number} [position] - 错误在公式中的位置
   */
  constructor(message, position) {
    super(message)
    this.name = 'FormulaSyntaxError'
    this.position = position
  }
}

/**
 * 将公式字符串拆分为 Token 数组
 * @param {string} formula - 公式字符串，如 "A1+B2*3"
 * @returns {Token[]} Token 数组
 */
export function tokenize(formula) {
  const tokens = []
  let i = 0

  while (i < formula.length) {
    const ch = formula[i]

    if (/\s/.test(ch)) {
      i++
      continue
    }

    if (ch === '(') {
      tokens.push(new Token(TOKEN_TYPES.LPAREN, '(', i))
      i++
      continue
    }

    if (ch === ')') {
      tokens.push(new Token(TOKEN_TYPES.RPAREN, ')', i))
      i++
      continue
    }

    if (ch === ',') {
      tokens.push(new Token(TOKEN_TYPES.COMMA, ',', i))
      i++
      continue
    }

    if (ch === ':') {
      tokens.push(new Token(TOKEN_TYPES.COLON, ':', i))
      i++
      continue
    }

    if (OPERATORS.has(ch)) {
      if (ch === '-' && (tokens.length === 0 || tokens[tokens.length - 1].type === TOKEN_TYPES.LPAREN || tokens[tokens.length - 1].type === TOKEN_TYPES.COMMA || tokens[tokens.length - 1].type === TOKEN_TYPES.OPERATOR)) {
        if (i + 1 < formula.length && /[\d.]/.test(formula[i + 1])) {
          let numStr = '-'
          i++
          while (i < formula.length && /[\d.]/.test(formula[i])) {
            numStr += formula[i]
            i++
          }
          tokens.push(new Token(TOKEN_TYPES.NUMBER, parseFloat(numStr), i - numStr.length))
          continue
        }
        tokens.push(new Token(TOKEN_TYPES.OPERATOR, ch, i))
        i++
        continue
      }
      tokens.push(new Token(TOKEN_TYPES.OPERATOR, ch, i))
      i++
      continue
    }

    if (/\d/.test(ch)) {
      let numStr = ''
      while (i < formula.length && /[\d.]/.test(formula[i])) {
        numStr += formula[i]
        i++
      }
      tokens.push(new Token(TOKEN_TYPES.NUMBER, parseFloat(numStr), i - numStr.length))
      continue
    }

    if (/[A-Z_]/i.test(ch)) {
      let ident = ''
      const startPos = i
      while (i < formula.length && /[A-Za-z0-9_]/.test(formula[i])) {
        ident += formula[i]
        i++
      }

      if (CELL_PATTERN.test(ident)) {
        tokens.push(new Token(TOKEN_TYPES.CELL_REF, ident, startPos))
      } else if (IDENTIFIER_PATTERN.test(ident)) {
        tokens.push(new Token(TOKEN_TYPES.IDENTIFIER, ident, startPos))
      } else {
        throw new FormulaSyntaxError(`无法识别的标识符 "${ident}" 在位置 ${startPos}`, startPos)
      }
      continue
    }

    throw new FormulaSyntaxError(`意外的字符 "${ch}" 在位置 ${i}`, i)
  }

  tokens.push(new Token(TOKEN_TYPES.EOF, null, i))
  return tokens
}

/**
 * AST 节点类型枚举
 * @enum {string}
 */
const AST_TYPES = {
  NUMBER_LITERAL: 'NumberLiteral',
  CELL_REF: 'CellRef',
  CELL_RANGE: 'CellRange',
  VARIABLE: 'Variable',
  BINARY_OP: 'BinaryOp',
  UNARY_MINUS: 'UnaryMinus',
  FUNCTION_CALL: 'FunctionCall'
}

/**
 * AST 节点
 * @typedef {Object} ASTNode
 * @property {string} type - 节点类型，取自 AST_TYPES
 * @property {number} [value] - 数值字面量的值
 * @property {string} [cellName] - 单元格引用名称
 * @property {string} [startCell] - 范围起始单元格
 * @property {string} [endCell] - 范围结束单元格
 * @property {string} [name] - 变量名或函数名
 * @property {string} [operator] - 二元运算符
 * @property {ASTNode} [left] - 左操作数
 * @property {ASTNode} [right] - 右操作数
 * @property {ASTNode} [operand] - 一元操作数
 * @property {ASTNode[]} [args] - 函数参数列表
 */

class ASTNode {
  /**
   * @param {string} type - 节点类型
   * @param {Object} [props={}] - 节点属性
   */
  constructor(type, props = {}) {
    this.type = type
    Object.assign(this, props)
  }
}

const PRECEDENCE = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2
}

/**
 * 语法解析器，将 Token 数组解析为 AST
 */
export class Parser {
  /**
   * @param {Token[]} tokens - tokenize() 返回的 Token 数组
   */
  constructor(tokens) {
    this.tokens = tokens
    this.pos = 0
  }

  current() {
    return this.tokens[this.pos]
  }

  advance() {
    const token = this.tokens[this.pos]
    this.pos++
    return token
  }

  expect(type) {
    const token = this.current()
    if (token.type !== type) {
      throw new FormulaSyntaxError(
        `期望 ${type}，但得到 ${token.type}("${token.value}") 在位置 ${token.position}`,
        token.position
      )
    }
    return this.advance()
  }

  /**
   * 执行完整解析，返回 AST 根节点
   * @returns {ASTNode}
   */
  parse() {
    const ast = this.parseExpression()
    if (this.current().type !== TOKEN_TYPES.EOF) {
      const token = this.current()
      throw new FormulaSyntaxError(
        `意外的 token "${token.value}" 在位置 ${token.position}`,
        token.position
      )
    }
    return ast
  }

  parseExpression() {
    return this.parseBinaryOp(0)
  }

  /**
   * @param {number} minPrecedence
   * @returns {ASTNode}
   */
  parseBinaryOp(minPrecedence) {
    let left = this.parsePrimary()

    while (
      this.current().type === TOKEN_TYPES.OPERATOR &&
      PRECEDENCE[this.current().value] > minPrecedence
    ) {
      const opToken = this.advance()
      const op = opToken.value
      const nextMinPrecedence = PRECEDENCE[op]
      const right = this.parseBinaryOp(nextMinPrecedence)
      left = new ASTNode(AST_TYPES.BINARY_OP, { operator: op, left, right })
    }

    return left
  }

  /**
   * @returns {ASTNode}
   */
  parsePrimary() {
    const token = this.current()

    if (token.type === TOKEN_TYPES.LPAREN) {
      this.advance()
      const expr = this.parseExpression()
      this.expect(TOKEN_TYPES.RPAREN)
      return expr
    }

    if (token.type === TOKEN_TYPES.OPERATOR && token.value === '-') {
      this.advance()
      const operand = this.parsePrimary()
      return new ASTNode(AST_TYPES.UNARY_MINUS, { operand })
    }

    if (token.type === TOKEN_TYPES.NUMBER) {
      this.advance()
      return new ASTNode(AST_TYPES.NUMBER_LITERAL, { value: token.value })
    }

    if (token.type === TOKEN_TYPES.CELL_REF) {
      this.advance()

      if (this.current().type === TOKEN_TYPES.COLON) {
        this.advance()
        const endToken = this.expect(TOKEN_TYPES.CELL_REF)
        return new ASTNode(AST_TYPES.CELL_RANGE, { startCell: token.value, endCell: endToken.value })
      }

      return new ASTNode(AST_TYPES.CELL_REF, { cellName: token.value })
    }

    if (token.type === TOKEN_TYPES.IDENTIFIER) {
      const name = token.value
      this.advance()

      if (this.current().type === TOKEN_TYPES.LPAREN) {
        this.advance()
        const args = []

        if (this.current().type !== TOKEN_TYPES.RPAREN) {
          args.push(this.parseExpression())
          while (this.current().type === TOKEN_TYPES.COMMA) {
            this.advance()
            args.push(this.parseExpression())
          }
        }

        this.expect(TOKEN_TYPES.RPAREN)
        return new ASTNode(AST_TYPES.FUNCTION_CALL, { name, args })
      }

      return new ASTNode(AST_TYPES.VARIABLE, { name })
    }

    throw new FormulaSyntaxError(
      `意外的 token "${token.value}" 在位置 ${token.position}`,
      token.position
    )
  }
}

/**
 * 解析公式字符串为 AST
 * @param {string} formulaStr - 公式字符串，如 "A1+B2*3" 或 "SUM(A1:B3)"
 * @returns {ASTNode} AST 根节点
 * @throws {FormulaSyntaxError} 公式语法错误时抛出
 */
export function parseFormula(formulaStr) {
  const tokens = tokenize(formulaStr)
  const parser = new Parser(tokens)
  return parser.parse()
}

/**
 * 从 AST 中提取所有单元格依赖
 * @param {ASTNode} ast - AST 根节点
 * @returns {string[]} 依赖的单元格名称数组
 */
export function extractDependencies(ast) {
  const deps = new Set()

  function walk(node) {
    if (!node) return

    switch (node.type) {
      case AST_TYPES.CELL_REF:
        deps.add(node.cellName)
        break
      case AST_TYPES.CELL_RANGE:
        expandCellRange(node.startCell, node.endCell).forEach((cell) => deps.add(cell))
        break
      case AST_TYPES.VARIABLE:
        break
      case AST_TYPES.BINARY_OP:
        walk(node.left)
        walk(node.right)
        break
      case AST_TYPES.UNARY_MINUS:
        walk(node.operand)
        break
      case AST_TYPES.FUNCTION_CALL:
        node.args.forEach(walk)
        break
    }
  }

  walk(ast)
  return [...deps]
}

/**
 * 解析单元格名称为列索引和行号
 * @param {string} cellName - 单元格名称，如 "A1", "B23"
 * @returns {{ colIndex: number, rowNum: number } | null}
 */
function parseCellName(cellName) {
  const match = cellName.match(/^([A-Z]+)(\d+)$/)
  if (!match) return null
  const colLetters = match[1]
  const rowNum = parseInt(match[2], 10)

  let colIndex = 0
  for (let i = 0; i < colLetters.length; i++) {
    colIndex = colIndex * 26 + (colLetters.charCodeAt(i) - 64)
  }

  return { colIndex, rowNum }
}

/**
 * 列索引转为字母
 * @param {number} index - 列索引（1-based）
 * @returns {string} 列字母，如 "A", "B", "AA"
 */
function colIndexToLetter(index) {
  let result = ''
  let n = index - 1
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26) - 1
  }
  return result
}

/**
 * 展开单元格范围为单元格名称数组
 * @param {string} startCell - 起始单元格，如 "A1"
 * @param {string} endCell - 结束单元格，如 "C3"
 * @returns {string[]} 范围内的所有单元格名称，如 ["A1","B1","C1","A2","B2","C2","A3","B3","C3"]
 */
export function expandCellRange(startCell, endCell) {
  const start = parseCellName(startCell)
  const end = parseCellName(endCell)
  if (!start || !end) return []

  const minCol = Math.min(start.colIndex, end.colIndex)
  const maxCol = Math.max(start.colIndex, end.colIndex)
  const minRow = Math.min(start.rowNum, end.rowNum)
  const maxRow = Math.max(start.rowNum, end.rowNum)

  const cells = []
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      cells.push(`${colIndexToLetter(col)}${row}`)
    }
  }
  return cells
}

export { AST_TYPES, ASTNode }
