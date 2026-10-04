const ts = require('typescript')
module.exports = function(source) {
  return ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, esModuleInterop: true }, fileName: this.resourcePath }).outputText
}
