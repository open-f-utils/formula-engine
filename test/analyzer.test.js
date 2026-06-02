import { describe, it, expect } from 'vitest'
import { getEvaluationOrder, buildDependencyGraph, CircularDependencyError } from '../src/dependency-analyzer'

describe('buildDependencyGraph', () => {
  it('should build graph with correct in-degrees', () => {
    const formulas = {
      A1: { dependencies: ['B1', 'C1'] },
      B1: { dependencies: ['C1'] },
      C1: { dependencies: [] }
    }
    const { inDegree, allCellNames } = buildDependencyGraph(formulas)
    expect(allCellNames).toEqual(new Set(['A1', 'B1', 'C1']))
    expect(inDegree['C1']).toBe(0)
    expect(inDegree['B1']).toBe(1)
    expect(inDegree['A1']).toBe(2)
  })

  it('should ignore dependencies outside formula set', () => {
    const formulas = {
      A1: { dependencies: ['B1', 'Z99'] },
      B1: { dependencies: [] }
    }
    const { inDegree } = buildDependencyGraph(formulas)
    expect(inDegree['A1']).toBe(1)
  })
})

describe('getEvaluationOrder', () => {
  it('should return correct order for simple dependencies', () => {
    const formulas = {
      C1: { dependencies: ['A1', 'B1'] },
      A1: { dependencies: [] },
      B1: { dependencies: ['A1'] }
    }
    const order = getEvaluationOrder(formulas)
    expect(order.indexOf('A1')).toBeLessThan(order.indexOf('B1'))
    expect(order.indexOf('B1')).toBeLessThan(order.indexOf('C1'))
  })

  it('should handle independent formulas', () => {
    const formulas = {
      A1: { dependencies: [] },
      B1: { dependencies: [] }
    }
    const order = getEvaluationOrder(formulas)
    expect(order.sort()).toEqual(['A1', 'B1'])
  })

  it('should detect circular dependencies', () => {
    const formulas = {
      A1: { dependencies: ['B1'] },
      B1: { dependencies: ['C1'] },
      C1: { dependencies: ['A1'] }
    }
    expect(() => getEvaluationOrder(formulas)).toThrow(CircularDependencyError)
  })

  it('should handle complex dependency chains', () => {
    const formulas = {
      C6: { dependencies: ['D6', 'E6', 'F6', 'G6', 'H6', 'I6', 'J6', 'K6'] },
      D6: { dependencies: ['D7', 'D12', 'D21'] },
      E6: { dependencies: ['E7', 'E12', 'E21'] },
      D7: { dependencies: [] },
      D12: { dependencies: [] },
      D21: { dependencies: [] },
      E7: { dependencies: [] },
      E12: { dependencies: [] },
      E21: { dependencies: [] },
      F6: { dependencies: [] },
      G6: { dependencies: [] },
      H6: { dependencies: [] },
      I6: { dependencies: [] },
      J6: { dependencies: [] },
      K6: { dependencies: [] }
    }
    const order = getEvaluationOrder(formulas)
    expect(order.indexOf('D7')).toBeLessThan(order.indexOf('D6'))
    expect(order.indexOf('D6')).toBeLessThan(order.indexOf('C6'))
  })
})
