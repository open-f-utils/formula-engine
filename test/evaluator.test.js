import { describe, it, expect } from 'vitest'
import { evaluateAST, createEvaluationContext, resolveFormulaString, FormulaEvaluationError } from '../src/formula-evaluator'
import { parseFormula } from '../src/formula-parser'

describe('evaluateAST', () => {
  it('should evaluate number literals', () => {
    const ast = parseFormula('42')
    const ctx = createEvaluationContext()
    expect(evaluateAST(ast, ctx).toNumber()).toBe(42)
  })

  it('should evaluate cell references', () => {
    const ast = parseFormula('A1')
    const ctx = createEvaluationContext({ A1: 10 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(10)
  })

  it('should evaluate variables', () => {
    const ast = parseFormula('rate')
    const ctx = createEvaluationContext({}, { rate: 0.05 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(0.05)
  })

  it('should evaluate cell ref from variables fallback', () => {
    const ast = parseFormula('D100')
    const ctx = createEvaluationContext({}, { D100: 42 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(42)
  })

  it('should return 0 for missing references', () => {
    const ast = parseFormula('Z99')
    const ctx = createEvaluationContext()
    expect(evaluateAST(ast, ctx).toNumber()).toBe(0)
  })

  it('should evaluate addition', () => {
    const ast = parseFormula('A1+B1')
    const ctx = createEvaluationContext({ A1: 3, B1: 7 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(10)
  })

  it('should evaluate subtraction', () => {
    const ast = parseFormula('A1-B1')
    const ctx = createEvaluationContext({ A1: 10, B1: 3 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(7)
  })

  it('should evaluate multiplication', () => {
    const ast = parseFormula('A1*B1')
    const ctx = createEvaluationContext({ A1: 4, B1: 5 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(20)
  })

  it('should evaluate division', () => {
    const ast = parseFormula('A1/B1')
    const ctx = createEvaluationContext({ A1: 20, B1: 4 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(5)
  })

  it('should throw on division by zero', () => {
    const ast = parseFormula('A1/B1')
    const ctx = createEvaluationContext({ A1: 10, B1: 0 })
    expect(() => evaluateAST(ast, ctx)).toThrow(FormulaEvaluationError)
  })

  it('should respect operator precedence', () => {
    const ast = parseFormula('A1+B1*C1')
    const ctx = createEvaluationContext({ A1: 2, B1: 3, C1: 4 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(14)
  })

  it('should evaluate parenthesized expressions', () => {
    const ast = parseFormula('(A1+B1)*C1')
    const ctx = createEvaluationContext({ A1: 2, B1: 3, C1: 4 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(20)
  })

  it('should evaluate unary minus', () => {
    const ast = parseFormula('-A1')
    const ctx = createEvaluationContext({ A1: 5 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(-5)
  })

  it('should evaluate SUM function', () => {
    const ast = parseFormula('SUM(A1,B1,C1)')
    const ctx = createEvaluationContext({ A1: 1, B1: 2, C1: 3 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(6)
  })

  it('should evaluate SUM with cell range', () => {
    const ast = parseFormula('SUM(A1:C1)')
    const ctx = createEvaluationContext({ A1: 10, B1: 20, C1: 30 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(60)
  })

  it('should evaluate MAX function', () => {
    const ast = parseFormula('MAX(A1,B1,C1)')
    const ctx = createEvaluationContext({ A1: 3, B1: 7, C1: 5 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(7)
  })

  it('should evaluate MIN function', () => {
    const ast = parseFormula('MIN(A1,B1,C1)')
    const ctx = createEvaluationContext({ A1: 3, B1: 7, C1: 5 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(3)
  })

  it('should evaluate AVERAGE function', () => {
    const ast = parseFormula('AVERAGE(A1,B1,C1)')
    const ctx = createEvaluationContext({ A1: 1, B1: 2, C1: 3 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(2)
  })

  it('should evaluate ABS function', () => {
    const ast = parseFormula('ABS(A1)')
    const ctx = createEvaluationContext({ A1: -5 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(5)
  })

  it('should evaluate ROUND function', () => {
    const ast = parseFormula('ROUND(A1,2)')
    const ctx = createEvaluationContext({ A1: 3.14159 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(3.14)
  })

  it('should evaluate IF function - true branch', () => {
    const ast = parseFormula('IF(A1,10,20)')
    const ctx = createEvaluationContext({ A1: 1 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(10)
  })

  it('should evaluate IF function - false branch', () => {
    const ast = parseFormula('IF(A1,10,20)')
    const ctx = createEvaluationContext({ A1: 0 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(20)
  })

  it('should evaluate POWER function', () => {
    const ast = parseFormula('POWER(A1,2)')
    const ctx = createEvaluationContext({ A1: 3 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(9)
  })

  it('should evaluate SQRT function', () => {
    const ast = parseFormula('SQRT(A1)')
    const ctx = createEvaluationContext({ A1: 16 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(4)
  })

  it('should evaluate complex formulas', () => {
    const ast = parseFormula('D110*173/10000')
    const ctx = createEvaluationContext({ D110: 20 })
    expect(evaluateAST(ast, ctx).toNumber()).toBeCloseTo(0.346, 2)
  })

  it('should use decimal precision for floating point', () => {
    const ast = parseFormula('A1*B1')
    const ctx = createEvaluationContext({ A1: 0.1, B1: 0.2 })
    expect(evaluateAST(ast, ctx).toNumber()).toBe(0.02)
  })

  it('should throw for undefined functions', () => {
    const ast = parseFormula('UNKNOWN(A1)')
    const ctx = createEvaluationContext({ A1: 1 })
    expect(() => evaluateAST(ast, ctx)).toThrow(FormulaEvaluationError)
  })
})

describe('resolveFormulaString', () => {
  it('should resolve single variable', () => {
    const ast = parseFormula('D110*173/10000')
    const ctx = createEvaluationContext({ D110: 20 })
    expect(resolveFormulaString(ast, ctx)).toBe('20*173/10000')
  })

  it('should resolve multiple variables', () => {
    const ast = parseFormula('A1+B1*C1')
    const ctx = createEvaluationContext({ A1: 2, B1: 3, C1: 4 })
    expect(resolveFormulaString(ast, ctx)).toBe('2+3*4')
  })

  it('should resolve variables from variables collection', () => {
    const ast = parseFormula('D100*173/10000')
    const ctx = createEvaluationContext({}, { D100: 42 })
    expect(resolveFormulaString(ast, ctx)).toBe('42*173/10000')
  })

  it('should use 0 for missing references', () => {
    const ast = parseFormula('A1+B1')
    const ctx = createEvaluationContext({ A1: 5 })
    expect(resolveFormulaString(ast, ctx)).toBe('5+0')
  })

  it('should resolve cell ranges as SUM', () => {
    const ast = parseFormula('SUM(A1:C1)')
    const ctx = createEvaluationContext({ A1: 10, B1: 20, C1: 30 })
    expect(resolveFormulaString(ast, ctx)).toBe('SUM(10,20,30)')
  })

  it('should preserve parentheses for precedence', () => {
    const ast = parseFormula('(A1+B1)*C1')
    const ctx = createEvaluationContext({ A1: 2, B1: 3, C1: 4 })
    expect(resolveFormulaString(ast, ctx)).toBe('(2+3)*4')
  })

  it('should handle integer values without decimals', () => {
    const ast = parseFormula('A1*173')
    const ctx = createEvaluationContext({ A1: 5 })
    expect(resolveFormulaString(ast, ctx)).toBe('5*173')
  })

  it('should handle decimal values', () => {
    const ast = parseFormula('A1*173')
    const ctx = createEvaluationContext({ A1: 5.5 })
    expect(resolveFormulaString(ast, ctx)).toBe('5.5*173')
  })

  it('should handle null/undefined as 0', () => {
    const ast = parseFormula('A1+173')
    const ctx = createEvaluationContext({ A1: null })
    expect(resolveFormulaString(ast, ctx)).toBe('0+173')
  })

  it('should handle unary minus', () => {
    const ast = parseFormula('-A1')
    const ctx = createEvaluationContext({ A1: 5 })
    expect(resolveFormulaString(ast, ctx)).toBe('(-5)')
  })

  it('should add grouping for subtraction right operand', () => {
    const ast = parseFormula('A1-(B1-C1)')
    const ctx = createEvaluationContext({ A1: 10, B1: 3, C1: 1 })
    expect(resolveFormulaString(ast, ctx)).toBe('10-(3-1)')
  })

  it('should resolve variable references', () => {
    const ast = parseFormula('rate*100')
    const ctx = createEvaluationContext({}, { rate: 0.05 })
    expect(resolveFormulaString(ast, ctx)).toBe('0.05*100')
  })
})
