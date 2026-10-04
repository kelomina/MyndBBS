// Webpack loads this test-only loader synchronously through its CommonJS API.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- required by the loader contract
const ts = require('typescript')
module.exports = function(source) {
  return ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, esModuleInterop: true }, fileName: this.resourcePath }).outputText
}
