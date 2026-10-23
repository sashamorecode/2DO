import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

export function loadService(name, modules) {
  const source = readFileSync(new URL(`../services/${name}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  new Function('require', 'exports', compiled)((id) => {
    assert.ok(id in modules, `unexpected import ${id}`);
    return modules[id];
  }, exports);
  return exports;
}
