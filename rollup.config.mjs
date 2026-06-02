import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import terser from '@rollup/plugin-terser'

const input = 'src/index.js'

const external = ['decimal.js']

const plugins = [
  resolve(),
  commonjs()
]

export default [
  {
    input,
    output: {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true
    },
    external,
    plugins: [...plugins, terser()]
  },
  {
    input,
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true
    },
    external,
    plugins: [...plugins, terser()]
  }
]
