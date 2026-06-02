# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-29

### Added
- Formula parser with tokenizer and AST generation
- Cell reference and cell range syntax support (e.g., `A1`, `SUM(A1:B3)`)
- Formula evaluator with decimal precision (decimal.js)
- Built-in functions: SUM, MAX, MIN, ABS, ROUND, CEIL, FLOOR, IF, AVERAGE, POWER, SQRT
- Dependency analyzer with Kahn's algorithm topological sorting
- Circular dependency detection with cycle path reporting
- Table data ↔ cell set bidirectional conversion
- Percentage cell processor
- Compilation caching (separate parsing from execution)
- Resolved formula string generation (variable substitution)
- Fluent API engine instance (createEngine)
- Variable fallback for missing cell references
