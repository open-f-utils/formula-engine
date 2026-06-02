# @f-utils/formula-engine

轻量级公式计算引擎，支持 Excel 风格的单元格引用、范围语法、依赖排序和精确小数运算。

## 特性

- **Excel 风格语法** — 支持 `A1`、`SUM(D6:K6)` 等单元格引用和范围语法
- **精确小数运算** — 基于 `decimal.js`，避免浮点数精度问题（`0.1 + 0.2 = 0.3`）
- **自动依赖排序** — Kahn 算法拓扑排序，自动确定公式计算顺序
- **循环依赖检测** — 检测并报告循环依赖路径
- **编译缓存** — 公式解析与求值分离，高频计算时避免重复解析
- **公式字符串还原** — 将公式中的引用替换为实际值，如 `D110*173/10000` → `20*173/10000`
- **表格数据转换** — 表格数据与单元格集合的双向转换，支持百分比处理
- **链式调用引擎** — 流畅的 API 设计，支持链式调用
- **TypeScript 支持** — 内置 `.d.ts` 类型声明
- **零副作用** — `sideEffects: false`，支持 tree-shaking

## 安装

```bash
npm install @f-utils/formula-engine decimal.js
```

> `decimal.js` 为 peer dependency，需同时安装。

## 快速开始

### 最简用法

```js
import { runFormulaEngine } from '@f-utils/formula-engine'

const result = runFormulaEngine(
  { A1: 'B1*C1', B1: '3', C1: '4' }
)

console.log(result.results)
// { B1: 3, C1: 4, A1: 12 }
```

### 编译 + 求值（推荐）

公式不变、数据频繁更新时，将编译与求值分离以获得最佳性能：

```js
import { compileFormulas, evaluateCompiled } from '@f-utils/formula-engine'

const formulaMap = {
  C6: 'SUM(D6:K6)',
  D6: 'D7+D12+D21',
  G110: 'D110*173/10000'
}

const compiled = compileFormulas(formulaMap)

const cells = { D7: 10, D12: 20, D21: 30, D110: 15 }
const result = evaluateCompiled(compiled, cells)

console.log(result.results)
// { D6: 60, C6: 60, G110: 0.2595 }
```

数据更新时只需重新调用 `evaluateCompiled`，无需重新解析公式：

```js
const newCells = { D7: 5, D12: 15, D21: 25, D110: 20 }
const result2 = evaluateCompiled(compiled, newCells)
```

### 链式调用引擎

```js
import { createEngine } from '@f-utils/formula-engine'

const result = createEngine()
  .setFormulas({ A1: 'B1+C1' })
  .setCells({ B1: 10, C1: 20 })
  .run()

console.log(result.results.A1) // 30
```

## 核心 API

### compileFormulas(formulaMap)

编译公式集合，返回可缓存的编译结果。

```js
const compiled = compileFormulas({
  A1: 'B1+C1',
  B1: 'D1*2'
})
// compiled.prepared    — 各公式的 AST 和依赖
// compiled.evaluationOrder — ['D1', 'B1', 'A1']（拓扑排序）
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| formulaMap | `Record<string, string>` | key 为 Cell 名称，value 为公式字符串 |

**返回：** `CompiledResult`

### evaluateCompiled(compiled, cells, variables, options)

对编译结果执行求值。

```js
const result = evaluateCompiled(compiled, { D1: 5 })
```

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| compiled | `CompiledResult` | — | `compileFormulas()` 的返回值 |
| cells | `Record<string, number>` | `{}` | 单元格数据 |
| variables | `Record<string, number>` | `{}` | 变量集合 |
| options | `EvaluateOptions` | `{}` | 求值选项 |

**EvaluateOptions：**

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| customFunctions | `Record<string, Function>` | `{}` | 自定义函数 |
| strict | `boolean` | `false` | 严格模式，计算失败时抛出异常 |
| withResolvedFormulas | `boolean` | `false` | 返回变量替换后的公式字符串 |

**返回：** `EvaluateResult`

```js
{
  results: { A1: 30, B1: 10 },       // 计算结果
  errors: {},                          // 错误信息
  allCellValues: { D1: 5, A1: 30 },   // 合并后的完整数据
  evaluationOrder: ['D1', 'B1', 'A1'], // 计算顺序
  resolvedFormulas: { A1: '10+20' }    // 仅 withResolvedFormulas=true
}
```

### runFormulaEngine(formulaMap, cells, variables, options)

一步完成编译和求值，适合一次性计算场景。

```js
const result = runFormulaEngine(
  { A1: 'B1+C1' },
  { B1: 10, C1: 20 }
)
```

### createEngine()

创建链式调用的引擎实例，适合需要多次计算的场景。

```js
const engine = createEngine()

engine
  .setFormulas({ A1: 'B1*C1' })
  .setCells({ B1: 5, C1: 4 })
  .setVariables({ rate: 0.05 })
  .registerFunction('DOUBLE', (val) => val * 2)

const result = engine.run()
```

**链式 API：**

| 方法 | 说明 |
|------|------|
| `setFormulas(map)` | 设置公式（合并） |
| `removeFormula(name)` | 移除公式 |
| `clearFormulas()` | 清空公式 |
| `setCells(map)` | 设置单元格数据（合并） |
| `setCell(name, value)` | 设置单个单元格 |
| `clearCells()` | 清空单元格 |
| `setVariables(map)` | 设置变量（合并） |
| `setVariable(name, value)` | 设置单个变量 |
| `clearVariables()` | 清空变量 |
| `registerFunction(name, fn)` | 注册自定义函数 |
| `registerFunctions(map)` | 批量注册函数 |
| `compile()` | 触发编译 |
| `run(options?)` | 执行求值 |
| `getFormulas()` | 获取当前公式集合 |
| `getCells()` | 获取当前单元格数据 |
| `getVariables()` | 获取当前变量集合 |

## 公式语法

### 数值字面量

```
42
3.14
-5
```

### 单元格引用

```
A1        → 引用 A1 单元格
D110      → 引用 D110 单元格
```

### 单元格范围

```
A1:C3     → 从 A1 到 C3 的所有单元格
D6:K6     → D6, E6, F6, G6, H6, I6, J6, K6
```

### 运算符

```
+  加法
-  减法
*  乘法
/  除法
```

支持括号和运算符优先级：

```
(A1+B1)*C1
A1+B1*C1     → 等价于 A1+(B1*C1)
```

### 变量

不以大写字母+数字结尾的标识符视为变量：

```
rate              → 变量
averageDaysPerMonth → 变量
```

### 内置函数

| 函数 | 语法 | 说明 |
|------|------|------|
| `SUM` | `SUM(A1,B2,C3)` 或 `SUM(A1:C3)` | 求和 |
| `MAX` | `MAX(A1,B1,C1)` | 最大值 |
| `MIN` | `MIN(A1,B1,C1)` | 最小值 |
| `AVERAGE` | `AVERAGE(A1,B1,C1)` | 平均值 |
| `ABS` | `ABS(A1)` | 绝对值 |
| `ROUND` | `ROUND(A1,2)` | 四舍五入 |
| `CEIL` | `CEIL(A1)` | 向上取整 |
| `FLOOR` | `FLOOR(A1)` | 向下取整 |
| `IF` | `IF(A1,100,0)` | 条件判断（非零为真） |
| `POWER` | `POWER(A1,2)` | 幂运算 |
| `SQRT` | `SQRT(A1)` | 平方根 |

### 自定义函数

```js
import { evaluateCompiled, compileFormulas } from '@f-utils/formula-engine'

const compiled = compileFormulas({ A1: 'TAX(B1,0.13)' })

const result = evaluateCompiled(compiled, { B1: 1000 }, {}, {
  customFunctions: {
    TAX: (base, rate) => base * rate
  }
})

console.log(result.results.A1) // 130
```

## 表格数据转换

### tableToCells(tableData, columnMap, options)

将表格行数据数组转换为单元格集合：

```js
import { tableToCells } from '@f-utils/formula-engine'

const tableData = [
  { name: 'Alice', score: 95 },
  { name: 'Bob', score: 87 }
]

const cells = tableToCells(tableData, ['name', 'score'], { rowStart: 1, colStart: 1 })
// { A1: 'Alice', B1: 95, A2: 'Bob', B2: 87 }
```

**Options：**

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| rowStart | `number` | `1` | 起始行号 |
| colStart | `number` | `1` | 起始列号（1-based） |
| processCell | `function` | `null` | 单元格值处理函数 |

### cellsToTable(cells, columnMap, options)

将单元格集合转换回表格数据数组：

```js
import { cellsToTable } from '@f-utils/formula-engine'

const cells = { A1: 'Alice', B1: 95, A2: 'Bob', B2: 87 }
const table = cellsToTable(cells, ['name', 'score'])
// [{ name: 'Alice', score: 95 }, { name: 'Bob', score: 87 }]
```

### createPercentProcessor(cellNames)

创建百分比处理器，将指定单元格的值除以 100：

```js
import { tableToCells, createPercentProcessor } from '@f-utils/formula-engine'

const tableData = [
  { name: '税率', value: 13 }   // 13 表示 13%
]

const processor = createPercentProcessor(['B1'])
const cells = tableToCells(tableData, ['name', 'value'], { processCell: processor })
// { A1: '税率', B1: 0.13 }
```

## 公式字符串还原

将公式中的引用替换为实际值，用于展示或审计：

```js
import { compileFormulas, evaluateCompiled } from '@f-utils/formula-engine'

const compiled = compileFormulas({
  G110: 'D110*173/10000',
  C6: 'SUM(D6:K6)'
})

const result = evaluateCompiled(
  compiled,
  { D110: 20, D6: 1, E6: 2, F6: 3, G6: 4, H6: 5, I6: 6, J6: 7, K6: 8 },
  {},
  { withResolvedFormulas: true }
)

console.log(result.resolvedFormulas)
// {
//   G110: '20*173/10000',
//   C6: 'SUM(1,2,3,4,5,6,7,8)'
// }
```

## 引用查找优先级

当公式引用一个单元格（如 `D100`）时，查找顺序为：

```
1. formulaResults → 已计算的公式结果
2. cells          → 传入的单元格数据
3. variables      → 变量集合
4. 0              → 都找不到，以 0 代入
```

这使得你可以将不在表格中但需要动态传入的值作为变量使用：

```js
const compiled = compileFormulas({ A1: 'D100*30' })

// D100 不在 cells 中，但作为变量传入
const result = evaluateCompiled(compiled, {}, { D100: 42 })
// result.results.A1 === 1260
```

## 错误处理

### 非严格模式（默认）

计算失败的公式结果为 0，错误信息记录在 `errors` 中：

```js
const result = evaluateCompiled(compiled, { B1: 0 })
// result.errors.A1 === '除零错误'
// result.results.A1 === 0
```

### 严格模式

任何公式计算失败都会抛出 `FormulaEngineError`：

```js
try {
  evaluateCompiled(compiled, { B1: 0 }, {}, { strict: true })
} catch (err) {
  console.log(err.name)    // FormulaEngineError
  console.log(err.details) // { cellName: 'A1', originalError: ... }
}
```

### 循环依赖检测

```js
try {
  compileFormulas({ A1: 'B1', B1: 'A1' })
} catch (err) {
  console.log(err.name)    // FormulaEngineError
  console.log(err.details) // { cycle: ['A1', 'B1'] }
}
```

## 完整示例

```js
import {
  tableToCells,
  compileFormulas,
  evaluateCompiled,
  createPercentProcessor
} from '@f-utils/formula-engine'

const columnMap = ['name', 'srValue', 'gtValue', 'dtValue']

const formulaMap = {
  C6: 'SUM(D6:K6)',
  D6: 'D7+D12+D21',
  G110: 'D110*173/10000'
}

const compiled = compileFormulas(formulaMap)

const tableData = [
  { name: '项目A', srValue: 100, gtValue: 200, dtValue: 150 }
]

const cells = tableToCells(tableData, columnMap, { rowStart: 6, colStart: 2 })

const result = evaluateCompiled(compiled, cells, {}, {
  withResolvedFormulas: true
})

console.log(result.results)
console.log(result.resolvedFormulas)
console.log(result.evaluationOrder)
```

## 开发

```bash
# 安装依赖
npm install

# 运行测试
npm test

# 监听模式
npm run test:watch

# 测试覆盖率
npm run test:coverage

# 构建
npm run build

# 预览发布内容
npm run pack:dry

# 类型检查
npm run typecheck
```

## License

MIT
