/**
 * @module dependency-analyzer
 * 公式依赖分析与拓扑排序模块，使用 Kahn 算法确定公式计算顺序
 */

/**
 * 循环依赖错误
 */
export class CircularDependencyError extends Error {
  /**
   * @param {string[]} cycle - 构成循环依赖的单元格路径
   */
  constructor(cycle) {
    const cycleStr = cycle.join(' → ')
    super(`检测到循环依赖: ${cycleStr}`)
    this.name = 'CircularDependencyError'
    this.cycle = cycle
  }
}

/**
 * 依赖图构建结果
 * @typedef {Object} DependencyGraph
 * @property {Record<string, string[]>} graph - 邻接表，key 为单元格，value 为依赖它的单元格列表
 * @property {Record<string, number>} inDegree - 各单元格的入度
 * @property {Set<string>} allCellNames - 所有单元格名称集合
 */

/**
 * 构建公式依赖图
 * @param {Record<string, { dependencies: string[] }>} formulas - 公式集合，每个公式含 dependencies 数组
 * @returns {DependencyGraph}
 */
export function buildDependencyGraph(formulas) {
  const graph = {}
  const inDegree = {}
  const allCellNames = new Set(Object.keys(formulas))

  allCellNames.forEach((cellName) => {
    graph[cellName] = []
    inDegree[cellName] = 0
  })

  Object.entries(formulas).forEach(([cellName, { dependencies }]) => {
    dependencies.forEach((dep) => {
      if (allCellNames.has(dep)) {
        graph[dep].push(cellName)
        inDegree[cellName] = (inDegree[cellName] || 0) + 1
      }
    })
  })

  return { graph, inDegree, allCellNames }
}

/**
 * 使用 Kahn 算法对公式进行拓扑排序
 * @param {Record<string, { dependencies: string[] }>} formulas - 公式集合
 * @returns {string[]} 拓扑排序后的单元格名称数组
 * @throws {CircularDependencyError} 检测到循环依赖时抛出
 */
export function topologicalSort(formulas) {
  const { graph, inDegree, allCellNames } = buildDependencyGraph(formulas)

  const queue = []
  allCellNames.forEach((cellName) => {
    if (inDegree[cellName] === 0) {
      queue.push(cellName)
    }
  })

  const sorted = []
  const visitedInDegree = { ...inDegree }

  while (queue.length > 0) {
    const current = queue.shift()
    sorted.push(current)

    const neighbors = graph[current] || []
    neighbors.forEach((neighbor) => {
      visitedInDegree[neighbor]--
      if (visitedInDegree[neighbor] === 0) {
        queue.push(neighbor)
      }
    })
  }

  if (sorted.length !== allCellNames.size) {
    const remaining = [...allCellNames].filter((name) => !sorted.includes(name))
    const cycle = detectCycle(formulas, remaining)
    throw new CircularDependencyError(cycle)
  }

  return sorted
}

/**
 * 使用 DFS 检测循环依赖路径
 * @param {Record<string, { dependencies: string[] }>} formulas - 公式集合
 * @param {string[]} remainingCells - 未被拓扑排序处理的单元格
 * @returns {string[]} 构成循环的单元格路径
 */
function detectCycle(formulas, remainingCells) {
  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = {}
  const path = []

  remainingCells.forEach((cell) => {
    color[cell] = WHITE
  })

  function dfs(node) {
    color[node] = GRAY
    path.push(node)

    const deps = formulas[node]?.dependencies || []
    for (const dep of deps) {
      if (!Object.prototype.hasOwnProperty.call(color, dep)) continue
      if (color[dep] === GRAY) {
        const cycleStart = path.indexOf(dep)
        return path.slice(cycleStart)
      }
      if (color[dep] === WHITE) {
        const result = dfs(dep)
        if (result) return result
      }
    }

    path.pop()
    color[node] = BLACK
    return null
  }

  for (const cell of remainingCells) {
    if (color[cell] === WHITE) {
      const result = dfs(cell)
      if (result) return result
    }
  }

  return remainingCells
}

/**
 * 获取公式的计算顺序（拓扑排序的便捷入口）
 * @param {Record<string, { dependencies: string[] }>} formulas - 公式集合
 * @returns {string[]} 计算顺序数组
 * @throws {CircularDependencyError}
 */
export function getEvaluationOrder(formulas) {
  return topologicalSort(formulas)
}
