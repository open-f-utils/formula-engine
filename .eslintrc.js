module.exports = {
  root: true,
  parser: 'espree',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      impliedStrict: true
    }
  },
  env: {
    es2020: true,
    node: true
  },
  rules: {
    'no-undef': 'error',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
  }
}
