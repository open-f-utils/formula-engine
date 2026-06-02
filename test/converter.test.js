import { describe, it, expect } from 'vitest'
import { tableToCells, cellsToTable, createPercentProcessor } from '../src/table-converter'

describe('tableToCells', () => {
  it('should convert table data to cells', () => {
    const data = [
      { name: 'Alice', value: 100 },
      { name: 'Bob', value: 200 }
    ]
    const cells = tableToCells(data, ['name', 'value'], { rowStart: 1, colStart: 1 })
    expect(cells.A1).toBe('Alice')
    expect(cells.B1).toBe(100)
    expect(cells.A2).toBe('Bob')
    expect(cells.B2).toBe(200)
  })

  it('should respect rowStart and colStart', () => {
    const data = [
      { name: 'Alice', value: 100 }
    ]
    const cells = tableToCells(data, ['name', 'value'], { rowStart: 6, colStart: 2 })
    expect(cells.B6).toBe('Alice')
    expect(cells.C6).toBe(100)
  })

  it('should convert null/undefined to 0', () => {
    const data = [
      { name: 'Alice', value: null },
      { name: null, value: undefined }
    ]
    const cells = tableToCells(data, ['name', 'value'])
    expect(cells.B1).toBe(0)
    expect(cells.A2).toBe(0)
    expect(cells.B2).toBe(0)
  })

  it('should apply processCell function', () => {
    const data = [
      { name: 'Alice', value: 50 }
    ]
    const percentProcessor = createPercentProcessor(['B1'])
    const cells = tableToCells(data, ['name', 'value'], { processCell: percentProcessor })
    expect(cells.B1).toBe(0.5)
  })
})

describe('createPercentProcessor', () => {
  it('should divide percent cells by 100', () => {
    const processor = createPercentProcessor(['A1', 'B2'])
    expect(processor('A1', 50)).toBe(0.5)
    expect(processor('B2', 25)).toBe(0.25)
  })

  it('should not modify non-percent cells', () => {
    const processor = createPercentProcessor(['A1'])
    expect(processor('C1', 50)).toBe(50)
  })

  it('should only process numeric values', () => {
    const processor = createPercentProcessor(['A1'])
    expect(processor('A1', 'text')).toBe('text')
  })
})

describe('cellsToTable', () => {
  it('should convert cells back to table data', () => {
    const cells = {
      A1: 'Alice',
      B1: 100,
      A2: 'Bob',
      B2: 200
    }
    const table = cellsToTable(cells, ['name', 'value'])
    expect(table[0]).toEqual({ name: 'Alice', value: 100 })
    expect(table[1]).toEqual({ name: 'Bob', value: 200 })
  })

  it('should respect rowStart and colStart', () => {
    const cells = {
      B6: 'Alice',
      C6: 100
    }
    const table = cellsToTable(cells, ['name', 'value'], { rowStart: 6, colStart: 2 })
    expect(table[0]).toEqual({ name: 'Alice', value: 100 })
  })

  it('should skip cells outside column range', () => {
    const cells = {
      A1: 'Alice',
      B1: 100,
      C1: 'extra'
    }
    const table = cellsToTable(cells, ['name', 'value'])
    expect(table[0]).toEqual({ name: 'Alice', value: 100 })
  })

  it('should round-trip with tableToCells', () => {
    const original = [
      { name: 'Alice', value: 100 },
      { name: 'Bob', value: 200 }
    ]
    const cells = tableToCells(original, ['name', 'value'])
    const result = cellsToTable(cells, ['name', 'value'])
    expect(result).toEqual(original)
  })
})
