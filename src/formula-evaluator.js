/**
 * @module formula-evaluator
 * 公式求值模块，支持精确小数运算、内置函数和自定义函数
 */

import Decimal from 'decimal.js'
import { AST_TYPES, expandCellRange } from './formula-parser'

/** @type {(val: any) => Decimal} */
const D = (val) => new Decimal(val == null ? 0 : val)

/**
 * 内置函数集合
 * @type {Record<string, Function>}
 */
const BUILTIN_FUNCTIONS = {
  SUM: (...args) => args.reduce((acc, val) => acc.plus(D(val)), D(0)),
  MAX: (...args) => {
    if (args.length === 0) return D(0)
    return args.reduce((max, val) => {
      const d = D(val)
      return d.greaterThan(max) ? d : max
    }, D(args[0]))
  },
  MIN: (...args) => {
    if (args.length === 0) return D(0)
    return args.reduce((min, val) => {
      const d = D(val)
      return d.lessThan(min) ? d : min
    }, D(args[0]))
  },
  ABS: (val) => D(val).abs(),
  ROUND: (val, precision = 0) => D(val).toDecimalPlaces(Number(precision), Decimal.ROUND_HALF_UP),
  CEIL: (val) => D(val).ceil(),
  FLOOR: (val) => D(val).floor(),
  IF: (condition, trueVal, falseVal) => {
    const condVal = D(condition)
    return condVal.isZero() ? D(falseVal) : D(trueVal)
  },
  AVERAGE: (...args) => {
    if (args.length === 0) return D(0)
    const sum = args.reduce((acc, val) => acc.plus(D(val)), D(0))
    return sum.div(args.length)
  },
  POWER: (base, exp) => D(base).pow(Number(exp)),
  SQRT: (val) => D(val).sqrt()
}

/**
 * 公式求值错误
 */
export class FormulaEvaluationError extends Error {
  /**
   * @param {string} message - 错误信息
   * @param {string} [cellName] - 出错的单元格名称
   */
  constructor(message, cellName) {
    super(cellName ? `[${cellName}] ${message}` : message)
    this.name = 'FormulaEvaluationError'
    this.cellName = cellName
  }
}

/**
 * 求值上下文
 * @typedef {Object} EvaluationContext
 * @property {Record<string, number>} cells - 单元格数据
 * @property {Record<string, number>} variables - 变量集合
 * @property {Record<string, Function>} customFunctions - 自定义函数
 * @property {Record<string, number>} formulaResults - 已计算的公式结果
 */

/**
 * 对 AST 节点递归求值，返回 Decimal 结果
 * @param {import('./formula-parser').ASTNode} node - AST 节点
 * @param {EvaluationContext} context - 求值上下文
 * @returns {Decimal} 计算结果
 * @throws {FormulaEvaluationError} 求值错误时抛出
 */
export function evaluateAST(node, context) {
  if (!node) {
    throw new FormulaEvaluationError('无效的 AST 节点')
  }

  switch (node.type) {
    case AST_TYPES.NUMBER_LITERAL:
      return D(node.value)

    case AST_TYPES.CELL_REF: {
      const value = resolveCellRef(node.cellName, context)
      return D(value)
    }

    case AST_TYPES.CELL_RANGE: {
      const cellNames = expandCellRange(node.startCell, node.endCell)
      return cellNames.reduce((sum, name) => sum.plus(D(resolveCellRef(name, context))), D(0))
    }

    case AST_TYPES.VARIABLE: {
      const value = resolveVariable(node.name, context)
      return D(value)
    }

    case AST_TYPES.UNARY_MINUS: {
      const operand = evaluateAST(node.operand, context)
      return operand.negated()
    }

    case AST_TYPES.BINARY_OP: {
      const left = evaluateAST(node.left, context)
      const right = evaluateAST(node.right, context)

      switch (node.operator) {
        case '+': return left.plus(right)
        case '-': return left.minus(right)
        case '*': return left.times(right)
        case '/':
          if (right.isZero()) {
            throw new FormulaEvaluationError('除零错误')
          }
          return left.div(right)
        default:
          throw new FormulaEvaluationError(`不支持的运算符: ${node.operator}`)
      }
    }

    case AST_TYPES.FUNCTION_CALL: {
      const fn = resolveFunction(node.name, context)
      if (!fn) {
        throw new FormulaEvaluationError(`未定义的函数: ${node.name}`)
      }
      const args = []
      node.args.forEach((arg) => {
        if (arg.type === AST_TYPES.CELL_RANGE) {
          const cellNames = expandCellRange(arg.startCell, arg.endCell)
          cellNames.forEach((name) => {
            args.push(D(resolveCellRef(name, context)))
          })
        } else {
          args.push(evaluateAST(arg, context))
        }
      })
      const result = fn(...args.map((a) => a.toNumber()))
      return D(result)
    }

    default:
      throw new FormulaEvaluationError(`未知的 AST 节点类型: ${node.type}`)
  }
}

/**
 * 解析单元格引用值，查找优先级：formulaResults → cells → variables → 0
 * @param {string} cellName - 单元格名称
 * @param {EvaluationContext} context - 求值上下文
 * @returns {number} 单元格值
 */
function resolveCellRef(cellName, context) {
  if (context.formulaResults && Object.prototype.hasOwnProperty.call(context.formulaResults, cellName)) {
    return context.formulaResults[cellName]
  }

  if (context.cells && Object.prototype.hasOwnProperty.call(context.cells, cellName)) {
    return context.cells[cellName]
  }

  if (context.variables && Object.prototype.hasOwnProperty.call(context.variables, cellName)) {
    return context.variables[cellName]
  }

  return 0
}

/**
 * 解析变量值
 * @param {string} name - 变量名
 * @param {EvaluationContext} context - 求值上下文
 * @returns {number} 变量值
 */
function resolveVariable(name, context) {
  if (context.variables && Object.prototype.hasOwnProperty.call(context.variables, name)) {
    return context.variables[name]
  }

  return 0
}

/**
 * 解析函数引用
 * @param {string} name - 函数名
 * @param {EvaluationContext} context - 求值上下文
 * @returns {Function|null} 函数引用
 */
function resolveFunction(name, context) {
  if (context.customFunctions && Object.prototype.hasOwnProperty.call(context.customFunctions, name)) {
    return context.customFunctions[name]
  }

  if (BUILTIN_FUNCTIONS[name]) {
    return BUILTIN_FUNCTIONS[name]
  }

  return null
}

/**
 * 注册自定义函数到上下文
 * @param {EvaluationContext} context - 求值上下文
 * @param {Record<string, Function>} functions - 自定义函数集合
 * @returns {EvaluationContext} 更新后的上下文
 */
export function registerCustomFunctions(context, functions) {
  context.customFunctions = {
    ...(context.customFunctions || {}),
    ...functions
  }
  return context
}

/**
 * 创建求值上下文
 * @param {Record<string, number>} [cells={}] - 单元格数据
 * @param {Record<string, number>} [variables={}] - 变量集合
 * @param {Record<string, Function>} [customFunctions={}] - 自定义函数
 * @returns {EvaluationContext}
 */
export function createEvaluationContext(cells = {}, variables = {}, customFunctions = {}) {
  return {
    cells,
    variables,
    customFunctions,
    formulaResults: {}
  }
}

/**
 * 将 AST 节点解析为变量替换后的公式字符串
 * @param {import('./formula-parser').ASTNode} node - AST 节点
 * @param {EvaluationContext} context - 求值上下文
 * @returns {string} 替换变量后的公式字符串，如 "20*173/10000"
 */
export function resolveFormulaString(node, context) {
  if (!node) return '0'

  switch (node.type) {
    case AST_TYPES.NUMBER_LITERAL: {
      return formatValue(node.value)
    }

    case AST_TYPES.CELL_REF: {
      const value = resolveCellRef(node.cellName, context)
      return formatValue(value)
    }

    case AST_TYPES.CELL_RANGE: {
      const cellNames = expandCellRange(node.startCell, node.endCell)
      const values = cellNames.map((name) => formatValue(resolveCellRef(name, context)))
      return `SUM(${values.join(',')})`
    }

    case AST_TYPES.VARIABLE: {
      const value = resolveVariable(node.name, context)
      return formatValue(value)
    }

    case AST_TYPES.UNARY_MINUS: {
      const operand = resolveFormulaString(node.operand, context)
      return `(-${operand})`
    }

    case AST_TYPES.BINARY_OP: {
      const left = resolveFormulaString(node.left, context)
      const right = resolveFormulaString(node.right, context)
      const needParensLeft = node.left.type === AST_TYPES.BINARY_OP && needsGrouping(node.left.operator, node.operator, 'left')
      const needParensRight = node.right.type === AST_TYPES.BINARY_OP && needsGrouping(node.right.operator, node.operator, 'right')
      const l = needParensLeft ? `(${left})` : left
      const r = needParensRight ? `(${right})` : right
      return `${l}${node.operator}${r}`
    }

    case AST_TYPES.FUNCTION_CALL: {
      const resolvedArgs = []
      node.args.forEach((arg) => {
        if (arg.type === AST_TYPES.CELL_RANGE) {
          const cellNames = expandCellRange(arg.startCell, arg.endCell)
          cellNames.forEach((name) => {
            resolvedArgs.push(formatValue(resolveCellRef(name, context)))
          })
        } else {
          resolvedArgs.push(resolveFormulaString(arg, context))
        }
      })
      return `${node.name}(${resolvedArgs.join(',')})`
    }

    default:
      return '0'
  }
}

/**
 * 格式化值为字符串，整数不带小数点，小数保留精度
 * @param {any} value - 要格式化的值
 * @returns {string}
 */
function formatValue(value) {
  if (value === null || value === undefined) return '0'
  if (typeof value === 'string') return value
  const num = Number(value)
  if (Number.isNaN(num)) return '0'
  if (Number.isInteger(num)) return String(num)
  return String(num)
}

/**
 * 判断子运算符是否需要加括号以保持运算优先级
 * @param {string} childOp - 子节点运算符
 * @param {string} parentOp - 父节点运算符
 * @param {'left'|'right'} position - 子节点在父节点中的位置
 * @returns {boolean}
 */
function needsGrouping(childOp, parentOp, position) {
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 }
  const childPrec = precedence[childOp] || 0
  const parentPrec = precedence[parentOp] || 0
  if (childPrec < parentPrec) return true
  if (childPrec === parentPrec && position === 'right' && (parentOp === '-' || parentOp === '/')) return true
  return false
}
