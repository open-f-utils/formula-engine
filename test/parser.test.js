import { describe, it, expect } from 'vitest'
import { tokenize, parseFormula, extractDependencies, expandCellRange, FormulaSyntaxError } from '../src/formula-parser'

describe('tokenize', () => {
  it('should tokenize numbers', () => {
    const tokens = tokenize('123')
    expect(tokens[0].type).toBe('NUMBER')
    expect(tokens[0].value).toBe(123)
  })

  it('should tokenize cell references', () => {
    const tokens = tokenize('A1')
    expect(tokens[0].type).toBe('CELL_REF')
    expect(tokens[0].value).toBe('A1')
  })

  it('should tokenize operators', () => {
    const tokens = tokenize('A1+B2*C3')
    expect(tokens.map((t) => t.value)).toEqual(['A1', '+', 'B2', '*', 'C3', null])
  })

  it('should tokenize function calls', () => {
    const tokens = tokenize('SUM(A1,B2)')
    expect(tokens.map((t) => t.type)).toEqual(['IDENTIFIER', 'LPAREN', 'CELL_REF', 'COMMA', 'CELL_REF', 'RPAREN', 'EOF'])
  })

  it('should tokenize cell ranges', () => {
    const tokens = tokenize('A1:B3')
    expect(tokens.map((t) => t.type)).toEqual(['CELL_REF', 'COLON', 'CELL_REF', 'EOF'])
  })

  it('should tokenize negative numbers', () => {
    const tokens = tokenize('-5')
    expect(tokens[0].type).toBe('NUMBER')
    expect(tokens[0].value).toBe(-5)
  })

  it('should skip whitespace', () => {
    const tokens = tokenize('A1 + B2')
    expect(tokens.map((t) => t.value)).toEqual(['A1', '+', 'B2', null])
  })

  it('should throw on unexpected characters', () => {
    expect(() => tokenize('A1@B2')).toThrow(FormulaSyntaxError)
  })
})

describe('parseFormula', () => {
  it('should parse simple addition', () => {
    const ast = parseFormula('A1+B1')
    expect(ast.type).toBe('BinaryOp')
    expect(ast.operator).toBe('+')
    expect(ast.left.cellName).toBe('A1')
    expect(ast.right.cellName).toBe('B1')
  })

  it('should respect operator precedence', () => {
    const ast = parseFormula('A1+B1*C1')
    expect(ast.type).toBe('BinaryOp')
    expect(ast.operator).toBe('+')
    expect(ast.left.cellName).toBe('A1')
    expect(ast.right.operator).toBe('*')
  })

  it('should parse parenthesized expressions', () => {
    const ast = parseFormula('(A1+B1)*C1')
    expect(ast.type).toBe('BinaryOp')
    expect(ast.operator).toBe('*')
    expect(ast.left.operator).toBe('+')
  })

  it('should parse function calls', () => {
    const ast = parseFormula('SUM(A1,B1,C1)')
    expect(ast.type).toBe('FunctionCall')
    expect(ast.name).toBe('SUM')
    expect(ast.args.length).toBe(3)
  })

  it('should parse cell ranges', () => {
    const ast = parseFormula('SUM(A1:C3)')
    expect(ast.type).toBe('FunctionCall')
    expect(ast.args[0].type).toBe('CellRange')
    expect(ast.args[0].startCell).toBe('A1')
    expect(ast.args[0].endCell).toBe('C3')
  })

  it('should parse variables', () => {
    const ast = parseFormula('averageDaysPerMonth')
    expect(ast.type).toBe('Variable')
    expect(ast.name).toBe('averageDaysPerMonth')
  })

  it('should parse unary minus', () => {
    const ast = parseFormula('-A1')
    expect(ast.type).toBe('UnaryMinus')
    expect(ast.operand.cellName).toBe('A1')
  })

  it('should parse complex formulas', () => {
    const ast = parseFormula('(D24/12*D32-D26/12)*8/36+D14+D17+D19')
    expect(ast.type).toBe('BinaryOp')
  })

  it('should throw on syntax errors', () => {
    expect(() => parseFormula('A1+')).toThrow(FormulaSyntaxError)
  })
})

describe('extractDependencies', () => {
  it('should extract cell references', () => {
    const ast = parseFormula('A1+B1')
    expect(extractDependencies(ast)).toEqual(['A1', 'B1'])
  })

  it('should expand range dependencies', () => {
    const ast = parseFormula('SUM(A1:B2)')
    const deps = extractDependencies(ast)
    expect(deps).toEqual(['A1', 'B1', 'A2', 'B2'])
  })

  it('should not include variables as dependencies', () => {
    const ast = parseFormula('A1*averageDaysPerMonth')
    const deps = extractDependencies(ast)
    expect(deps).toEqual(['A1'])
  })

  it('should deduplicate dependencies', () => {
    const ast = parseFormula('A1+A1')
    const deps = extractDependencies(ast)
    expect(deps).toEqual(['A1'])
  })
})

describe('expandCellRange', () => {
  it('should expand a simple range', () => {
    expect(expandCellRange('A1', 'C1')).toEqual(['A1', 'B1', 'C1'])
  })

  it('should expand a 2D range', () => {
    expect(expandCellRange('A1', 'B2')).toEqual(['A1', 'B1', 'A2', 'B2'])
  })

  it('should expand a column range', () => {
    expect(expandCellRange('D6', 'K6')).toEqual([
      'D6', 'E6', 'F6', 'G6', 'H6', 'I6', 'J6', 'K6'
    ])
  })

  it('should handle reverse ranges', () => {
    expect(expandCellRange('C1', 'A1')).toEqual(['A1', 'B1', 'C1'])
  })

  it('should return empty for invalid cell names', () => {
    expect(expandCellRange('abc', 'def')).toEqual([])
  })
})
