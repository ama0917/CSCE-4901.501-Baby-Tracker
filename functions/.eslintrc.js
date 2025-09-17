// functions/.eslintrc.js
module.exports = {
  env: { es2020: true, node: true },
  extends: ['eslint:recommended', 'google'],
  parserOptions: { ecmaVersion: 2020 },
  rules: {
    'require-jsdoc': 'off',
    'max-len': 'off',
    'object-curly-spacing': 'off',
    'indent': 'off',
  },
};
