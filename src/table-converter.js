/**
 * @module table-converter
 * 表格数据与单元格集合的双向转换模块
 */

import Decimal from 'decimal.js'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * 列索引转字母（1-based）
 * @param {number} index - 列索引，1 = A, 2 = B, ...
 * @returns {string} 列字母
 */
function columnIndexToLetter(index) {
  let result = ''
  let n = index
  while (n >= 0) {
    result = ALPHABET[n % 26] + result
    n = Math.floor(n / 26) - 1
  }
  return result
}

/**
 * 表格转换配置
 * @typedef {Object} TableToCellsOptions
 * @property {number} [rowStart=1] - 起始行号
 * @property {number} [colStart=1] - 起始列号（1-based）
 * @property {function(string, *): *} [processCell=null] - 单元格值处理函数，接收 (cellName, value)，返回处理后的值
 */

/**
 * 将表格数据数组转换为单元格集合
 * @param {Object[]} tableData - 表格行数据数组
 * @param {string[]} columnMap - 列属性名映射数组，如 ['name', 'value']
 * @param {TableToCellsOptions} [options={}] - 转换配置
 * @returns {Record<string, number>} 单元格集合，key 为 "A1" 格式，value 为数值
 */
export function tableToCells(tableData, columnMap, options = {}) {
  const {
    rowStart = 1,
    colStart = 1,
    processCell = null
  } = options

  const cells = {}

  tableData.forEach((row, rowOffset) => {
    const rowNum = rowStart + rowOffset
    columnMap.forEach((prop, colOffset) => {
      const colLetter = columnIndexToLetter(colStart + colOffset - 1)
      const cellName = `${colLetter}${rowNum}`
      let cellValue = row[prop]

      if (cellValue === null || cellValue === undefined) {
        cellValue = 0
      }

      if (typeof processCell === 'function') {
        cellValue = processCell(cellName, cellValue)
      }

      cells[cellName] = cellValue
    })
  })

  return cells
}

/**
 * 创建百分比单元格处理器
 * 将指定单元格的值除以 100（如 50% → 0.5）
 * @param {string[]} [percentCellNames=[]] - 需要进行百分比处理的单元格名称数组
 * @returns {function(string, *): *} 处理函数，可直接传入 tableToCells 的 processCell 选项
 */
export function createPercentProcessor(percentCellNames = []) {
  const percentSet = new Set(percentCellNames)
  return (cellName, cellValue) => {
    if (percentSet.has(cellName) && typeof cellValue === 'number') {
      return new Decimal(cellValue).div(100).toNumber()
    }
    return cellValue
  }
}

/**
 * 单元格转表格配置
 * @typedef {Object} CellsToTableOptions
 * @property {number} [rowStart=1] - 起始行号
 * @property {number} [colStart=1] - 起始列号（1-based）
 */

/**
 * 将单元格集合转换回表格数据数组
 * @param {Record<string, number>} cells - 单元格集合
 * @param {string[]} columnMap - 列属性名映射数组
 * @param {CellsToTableOptions} [options={}] - 转换配置
 * @returns {Object[]} 表格行数据数组
 */
export function cellsToTable(cells, columnMap, options = {}) {
  const { rowStart = 1, colStart = 1 } = options
  const rows = {}

  Object.entries(cells).forEach(([cellName, value]) => {
    const match = cellName.match(/^([A-Z]+)(\d+)$/)
    if (!match) return
    const rowNum = parseInt(match[2], 10)
    const colLetters = match[1]

    let colIndex = 0
    for (let i = 0; i < colLetters.length; i++) {
      colIndex = colIndex * 26 + (colLetters.charCodeAt(i) - 64)
    }

    const colOffset = colIndex - colStart
    const rowOffset = rowNum - rowStart

    if (colOffset < 0 || colOffset >= columnMap.length) return
    if (rowOffset < 0) return

    const prop = columnMap[colOffset]
    if (!rows[rowOffset]) rows[rowOffset] = {}
    rows[rowOffset][prop] = value
  })

  const maxRow = Math.max(...Object.keys(rows).map(Number), -1)
  const result = []
  for (let i = 0; i <= maxRow; i++) {
    result.push(rows[i] || {})
  }
  return result
}
