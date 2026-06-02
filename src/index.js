/**
 * @module formula-engine
 * 公式计算引擎主入口，提供编译、求值、引擎实例等核心 API
 */

import { parseFormula, extractDependencies } from './formula-parser'
import { getEvaluationOrder, CircularDependencyError } from './dependency-analyzer'
import { evaluateAST, createEvaluationContext, resolveFormulaString } from './formula-evaluator'

export { parseFormula, extractDependencies, expandCellRange, AST_TYPES } from './formula-parser'
export { getEvaluationOrder, CircularDependencyError } from './dependency-analyzer'
export { evaluateAST, createEvaluationContext, FormulaEvaluationError, resolveFormulaString } from './formula-evaluator'
export { tableToCells, cellsToTable, createPercentProcessor } from './table-converter'

/**
 * 引擎错误基类
 */
export class FormulaEngineError extends Error {
  /**
   * @param {string} message - 错误信息
   * @param {Object} [details={}] - 错误详情
   */
  constructor(message, details = {}) {
    super(message)
    this.name = 'FormulaEngineError'
    this.details = details
  }
}

/**
 * 编译准备结果
 * @typedef {Object} PreparedFormula
 * @property {string} formula - 原始公式字符串
 * @property {import('./formula-parser').ASTNode} ast - 解析后的 AST
 * @property {string[]} dependencies - 依赖的单元格列表
 */

/**
 * 编译结果
 * @typedef {Object} CompiledResult
 * @property {Record<string, PreparedFormula>} prepared - 各公式的编译准备结果
 * @property {string[]} evaluationOrder - 拓扑排序后的计算顺序
 */

/**
 * 预处理公式集合，解析每个公式为 AST 并提取依赖
 * @param {Record<string, string>} formulaMap - 公式映射表，key 为 Cell 名称，value 为公式字符串
 * @returns {Record<string, PreparedFormula>}
 * @throws {FormulaEngineError} 公式解析失败时抛出
 */
export function prepareFormulas(formulaMap) {
  const prepared = {}

  Object.entries(formulaMap).forEach(([cellName, formulaStr]) => {
    try {
      const ast = parseFormula(formulaStr)
      const dependencies = extractDependencies(ast)
      prepared[cellName] = { formula: formulaStr, ast, dependencies }
    } catch (err) {
      throw new FormulaEngineError(
        `公式 "${cellName}" 解析失败: ${err.message}`,
        { cellName, formula: formulaStr, originalError: err }
      )
    }
  })

  return prepared
}

/**
 * 编译公式集合，返回可缓存的编译结果（解析 + 拓扑排序）
 * @param {Record<string, string>} formulaMap - 公式映射表
 * @returns {CompiledResult}
 * @throws {FormulaEngineError} 循环依赖或解析错误时抛出
 */
export function compileFormulas(formulaMap) {
  const prepared = prepareFormulas(formulaMap)

  let evaluationOrder
  try {
    evaluationOrder = getEvaluationOrder(prepared)
  } catch (err) {
    if (err instanceof CircularDependencyError) {
      throw new FormulaEngineError(`循环依赖检测失败: ${err.message}`, { cycle: err.cycle })
    }
    throw err
  }

  return {
    prepared,
    evaluationOrder
  }
}

/**
 * 求值选项
 * @typedef {Object} EvaluateOptions
 * @property {Record<string, Function>} [customFunctions={}] - 自定义函数集合
 * @property {boolean} [strict=false] - 严格模式，任何公式计算失败都会抛出异常
 * @property {boolean} [withResolvedFormulas=false] - 是否在结果中包含变量替换后的公式字符串
 */

/**
 * 求值结果
 * @typedef {Object} EvaluateResult
 * @property {Record<string, number>} results - 各公式的计算结果
 * @property {Record<string, string>} errors - 各公式的错误信息
 * @property {Record<string, number>} allCellValues - 合并了输入数据和计算结果的完整单元格值集合
 * @property {string[]} evaluationOrder - 计算顺序
 * @property {Record<string, string>} [resolvedFormulas] - 变量替换后的公式字符串（仅 withResolvedFormulas=true 时存在）
 */

/**
 * 对编译结果执行求值
 * @param {CompiledResult} compiled - compileFormulas() 返回的编译结果
 * @param {Record<string, number>} [cells={}] - 单元格数据
 * @param {Record<string, number>} [variables={}] - 变量集合
 * @param {EvaluateOptions} [options={}] - 求值选项
 * @returns {EvaluateResult}
 */
export function evaluateCompiled(compiled, cells = {}, variables = {}, options = {}) {
  const { customFunctions = {}, strict = false, withResolvedFormulas = false } = options
  const { prepared, evaluationOrder } = compiled

  const context = createEvaluationContext(cells, variables, customFunctions)
  const results = {}
  const errors = {}
  const resolvedFormulas = {}

  evaluationOrder.forEach((cellName) => {
    const { ast } = prepared[cellName]
    try {
      const value = evaluateAST(ast, context)
      results[cellName] = value.toNumber()
      context.formulaResults[cellName] = value.toNumber()
    } catch (err) {
      errors[cellName] = err.message
      if (strict) {
        throw new FormulaEngineError(
          `公式 "${cellName}" 计算失败: ${err.message}`,
          { cellName, originalError: err }
        )
      }
      results[cellName] = 0
      context.formulaResults[cellName] = 0
    }

    if (withResolvedFormulas) {
      try {
        resolvedFormulas[cellName] = resolveFormulaString(ast, context)
      } catch (err) {
        resolvedFormulas[cellName] = prepared[cellName].formula
      }
    }
  })

  const returnValue = {
    results,
    errors,
    allCellValues: {
      ...cells,
      ...results
    },
    evaluationOrder
  }

  if (withResolvedFormulas) {
    returnValue.resolvedFormulas = resolvedFormulas
  }

  return returnValue
}

/**
 * 一步完成公式编译和求值
 * @param {Record<string, string>} formulaMap - 公式映射表
 * @param {Record<string, number>} [cells={}] - 单元格数据
 * @param {Record<string, number>} [variables={}] - 变量集合
 * @param {EvaluateOptions} [options={}] - 求值选项
 * @returns {EvaluateResult}
 */
export function runFormulaEngine(formulaMap, cells = {}, variables = {}, options = {}) {
  const compiled = compileFormulas(formulaMap)
  return evaluateCompiled(compiled, cells, variables, options)
}

/**
 * 引擎实例
 * @typedef {Object} EngineInstance
 * @property {function(Object): EngineInstance} setFormulas - 设置公式（合并）
 * @property {function(string): EngineInstance} removeFormula - 移除指定公式
 * @property {function(): EngineInstance} clearFormulas - 清空所有公式
 * @property {function(Object): EngineInstance} setCells - 设置单元格数据（合并）
 * @property {function(string, number): EngineInstance} setCell - 设置单个单元格值
 * @property {function(): EngineInstance} clearCells - 清空所有单元格数据
 * @property {function(Object): EngineInstance} setVariables - 设置变量（合并）
 * @property {function(string, number): EngineInstance} setVariable - 设置单个变量
 * @property {function(): EngineInstance} clearVariables - 清空所有变量
 * @property {function(string, Function): EngineInstance} registerFunction - 注册自定义函数
 * @property {function(Object): EngineInstance} registerFunctions - 批量注册自定义函数
 * @property {function(): EngineInstance} compile - 触发编译
 * @property {function(EvaluateOptions): EvaluateResult} run - 执行求值
 * @property {function(): Record<string, string>} getFormulas - 获取当前公式集合
 * @property {function(): Record<string, number>} getCells - 获取当前单元格数据
 * @property {function(): Record<string, number>} getVariables - 获取当前变量集合
 */

/**
 * 创建链式调用的引擎实例
 * @returns {EngineInstance}
 */
export function createEngine() {
  let formulaMap = {}
  let cells = {}
  let variables = {}
  let customFunctions = {}
  let compiledCache = null
  let formulaMapDirty = true

  function ensureCompiled() {
    if (formulaMapDirty || !compiledCache) {
      compiledCache = compileFormulas(formulaMap)
      formulaMapDirty = false
    }
    return compiledCache
  }

  const engine = {
    setFormulas(formulas) {
      formulaMap = { ...formulaMap, ...formulas }
      formulaMapDirty = true
      return engine
    },

    removeFormula(cellName) {
      delete formulaMap[cellName]
      formulaMapDirty = true
      return engine
    },

    clearFormulas() {
      formulaMap = {}
      formulaMapDirty = true
      return engine
    },

    setCells(newCells) {
      cells = { ...cells, ...newCells }
      return engine
    },

    setCell(cellName, value) {
      cells[cellName] = value
      return engine
    },

    clearCells() {
      cells = {}
      return engine
    },

    setVariables(newVariables) {
      variables = { ...variables, ...newVariables }
      return engine
    },

    setVariable(name, value) {
      variables[name] = value
      return engine
    },

    clearVariables() {
      variables = {}
      return engine
    },

    registerFunction(name, fn) {
      customFunctions[name] = fn
      return engine
    },

    registerFunctions(fns) {
      customFunctions = { ...customFunctions, ...fns }
      return engine
    },

    compile() {
      ensureCompiled()
      return engine
    },

    run(options = {}) {
      const compiled = ensureCompiled()
      return evaluateCompiled(compiled, cells, variables, {
        ...options,
        customFunctions
      })
    },

    getFormulas() {
      return { ...formulaMap }
    },

    getCells() {
      return { ...cells }
    },

    getVariables() {
      return { ...variables }
    }
  }

  return engine
}
