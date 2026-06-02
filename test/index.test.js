import { describe, it, expect } from 'vitest'
import { compileFormulas, evaluateCompiled, runFormulaEngine, createEngine, FormulaEngineError } from '../src/index'

describe('compileFormulas', () => {
  it('should compile formulas and return evaluation order', () => {
    const compiled = compileFormulas({
      C6: 'SUM(D6:K6)',
      D6: 'D7+D12'
    })
    expect(compiled.evaluationOrder).toBeDefined()
    expect(compiled.prepared).toBeDefined()
    expect(compiled.prepared.C6.formula).toBe('SUM(D6:K6)')
  })

  it('should detect circular dependencies', () => {
    expect(() => compileFormulas({
      A1: 'B1',
      B1: 'C1',
      C1: 'A1'
    })).toThrow(FormulaEngineError)
  })

  it('should throw on invalid formulas', () => {
    expect(() => compileFormulas({
      A1: '1+'
    })).toThrow(FormulaEngineError)
  })
})

describe('evaluateCompiled', () => {
  it('should evaluate compiled formulas', () => {
    const compiled = compileFormulas({
      C6: 'SUM(D6:K6)',
      D6: 'D7+D12',
      E6: '10'
    })
    const result = evaluateCompiled(compiled, { D7: 1, D12: 2, E6: 10, F6: 0, G6: 0, H6: 0, I6: 0, J6: 0, K6: 0 })
    expect(result.results.D6).toBe(3)
    expect(result.results.C6).toBe(13)
  })

  it('should return resolvedFormulas when requested', () => {
    const compiled = compileFormulas({
      G110: 'D110*173/10000'
    })
    const result = evaluateCompiled(compiled, { D110: 20 }, {}, { withResolvedFormulas: true })
    expect(result.resolvedFormulas.G110).toBe('20*173/10000')
  })

  it('should not include resolvedFormulas by default', () => {
    const compiled = compileFormulas({ A1: 'B1+1' })
    const result = evaluateCompiled(compiled, { B1: 5 })
    expect(result.resolvedFormulas).toBeUndefined()
  })

  it('should use 0 for missing cell references', () => {
    const compiled = compileFormulas({ A1: 'B1+C1' })
    const result = evaluateCompiled(compiled, { B1: 5 })
    expect(result.results.A1).toBe(5)
  })

  it('should look up variables for cell refs not in cells', () => {
    const compiled = compileFormulas({ A1: 'D100+1' })
    const result = evaluateCompiled(compiled, {}, { D100: 42 })
    expect(result.results.A1).toBe(43)
  })

  it('should handle errors in non-strict mode', () => {
    const compiled = compileFormulas({ A1: '1/0' })
    const result = evaluateCompiled(compiled)
    expect(result.errors.A1).toBeDefined()
    expect(result.results.A1).toBe(0)
  })

  it('should throw in strict mode', () => {
    const compiled = compileFormulas({ A1: '1/0' })
    expect(() => evaluateCompiled(compiled, {}, {}, { strict: true })).toThrow(FormulaEngineError)
  })

  it('should merge allCellValues', () => {
    const compiled = compileFormulas({ A1: 'B1+1' })
    const result = evaluateCompiled(compiled, { B1: 5, C1: 99 })
    expect(result.allCellValues.B1).toBe(5)
    expect(result.allCellValues.C1).toBe(99)
    expect(result.allCellValues.A1).toBe(6)
  })
})

describe('runFormulaEngine', () => {
  it('should compile and evaluate in one step', () => {
    const result = runFormulaEngine(
      { A1: 'B1*C1', B1: '3', C1: '4' }
    )
    expect(result.results.B1).toBe(3)
    expect(result.results.C1).toBe(4)
    expect(result.results.A1).toBe(12)
  })
})

describe('createEngine', () => {
  it('should support fluent API', () => {
    const result = createEngine()
      .setFormulas({ A1: 'B1+C1' })
      .setCells({ B1: 10, C1: 20 })
      .run()
    expect(result.results.A1).toBe(30)
  })

  it('should cache compilation', () => {
    const engine = createEngine()
      .setFormulas({ A1: 'B1+1' })
      .compile()

    const r1 = engine.setCells({ B1: 5 }).run()
    const r2 = engine.setCells({ B1: 10 }).run()
    expect(r1.results.A1).toBe(6)
    expect(r2.results.A1).toBe(11)
  })

  it('should recompile when formulas change', () => {
    const engine = createEngine()
      .setFormulas({ A1: 'B1+1' })
      .setCells({ B1: 5 })

    const r1 = engine.run()
    expect(r1.results.A1).toBe(6)

    engine.setFormulas({ A1: 'B1*2' })
    const r2 = engine.run()
    expect(r2.results.A1).toBe(10)
  })

  it('should support custom functions', () => {
    const result = createEngine()
      .setFormulas({ A1: 'DOUBLE(B1)' })
      .setCells({ B1: 5 })
      .registerFunction('DOUBLE', (val) => val * 2)
      .run()
    expect(result.results.A1).toBe(10)
  })

  it('should support variables', () => {
    const result = createEngine()
      .setFormulas({ A1: 'rate*B1' })
      .setCells({ B1: 100 })
      .setVariables({ rate: 0.05 })
      .run()
    expect(result.results.A1).toBe(5)
  })

  it('should support removeFormula', () => {
    const engine = createEngine()
      .setFormulas({ A1: 'B1+1', C1: 'D1+1' })
      .setCells({ B1: 5, D1: 10 })
    engine.removeFormula('A1')
    const result = engine.run()
    expect(result.results.A1).toBeUndefined()
    expect(result.results.C1).toBe(11)
  })
})
