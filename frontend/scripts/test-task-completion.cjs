const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const base = require('node:path').resolve(__dirname, '..');
const ts = require(base + '/node_modules/typescript');
const source = ts.transpileModule(fs.readFileSync(base + '/components/todo/TodoCard.tsx', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React}}).outputText;
function setup(measure, failCelebration = false) {
  let refs = 0, saved = 0, celebrations = 0;
  const timers = new Map(); let timerId = 0;
  const react = {useRef: value => ({current: refs++ === 0 ? {measureInWindow: measure} : value}), createElement: (type, props, ...children) => ({type,props:props || {},children}), Fragment:'Fragment'};
  const module = {exports:{}};
  vm.runInNewContext(source, {module,exports:module.exports,setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),require:name=>{
    if(name==='react')return {...react,default:react};
    if(name==='react-native')return {View:'View',Text:'Text',TouchableOpacity:'TouchableOpacity',ActivityIndicator:'ActivityIndicator',StyleSheet:{create:x=>x}};
    if(name.includes('/Celebration'))return {celebrate:()=>{if(failCelebration)throw Error('overlay unavailable');celebrations++}};
    if(name.includes('/colors'))return {colors:{}};
    return new Proxy({}, {get:(_,key)=>key});
  }});
  const tree=module.exports.TodoCard({todo:{id:'task-1',title:'Gift',tags:[],steps:[]},onComplete:id=>{assert.equal(id,'task-1');saved++}});
  function find(node){if(!node || typeof node!=='object')return; if(node.type==='CompletionButton')return node;for(const c of (node.children || []).flat(Infinity)){const match=find(c);if(match)return match}}
  const button=find(tree);assert.ok(button);
  return {click:button.props.onComplete,flush:()=>{for(const fn of [...timers.values()])fn()},counts:()=>({saved,celebrations})};
}
let callback;
let t=setup(cb=>{callback=cb});t.click();t.click();assert.deepEqual(t.counts(),{saved:0,celebrations:0});callback(10,20,300,110);t.flush();t.click();assert.deepEqual(t.counts(),{saved:1,celebrations:1});
t=setup(cb=>{callback=cb});t.click();t.flush();callback(10,20,300,110);assert.deepEqual(t.counts(),{saved:1,celebrations:0});
t=setup(()=>{throw Error('unmounted')});t.click();t.flush();assert.deepEqual(t.counts(),{saved:1,celebrations:0});
t=setup(cb=>cb(0,0,0,0));t.click();t.flush();assert.deepEqual(t.counts(),{saved:1,celebrations:0});
t=setup(cb=>cb(10,20,300,110),true);t.click();t.flush();assert.deepEqual(t.counts(),{saved:1,celebrations:0});
console.log('PASS: one save per tap sequence; missing, late, throwing and zero-size measurements still save without duplicate celebrations.');
