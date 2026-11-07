const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const base = path.resolve(__dirname, '..');
const filename = path.join(base, 'components/completion/Celebration.tsx');
const source = process.env.CELEBRATION_SOURCE ? fs.readFileSync(process.env.CELEBRATION_SOURCE, 'utf8') : fs.readFileSync(filename, 'utf8');
const { code } = babel.transformSync(source + '\nexports.testFlight = GiftFlight;', {
  filename, configFile: false, babelrc: false, compact: false,
  presets: [[require.resolve('babel-preset-expo'), { jsxRuntime: 'classic' }]],
  plugins: [require.resolve('react-native-worklets/plugin')],
  caller: { name: 'metro', platform: 'android', isDev: false },
});
let clock;
const styles = [];
const react = {
  createRef: () => ({ current: null }), forwardRef: fn => fn,
  useEffect: () => {}, useSharedValue: () => {},
  createElement: () => null,
};
const reanimated = {
  useSharedValue: value => (clock = { value }),
  useAnimatedStyle: mapper => { styles.push(mapper); return {}; },
  Extrapolation: { CLAMP: 'clamp' },
  interpolate: (v, input, output) => {
    if (v <= input[0]) return output[0];
    for (let i = 1; i < input.length; i++) {
      if (v <= input[i]) return output[i - 1] + (output[i] - output[i - 1]) * (v - input[i - 1]) / (input[i] - input[i - 1]);
    }
    return output.at(-1);
  },
};
const moduleObject = { exports: {} };
vm.runInNewContext(code, { global: { Error }, exports: moduleObject.exports, module: moduleObject, require: name => {
  if (name === 'react') return { ...react, default: react };
  if (name === 'react-native') return { StyleSheet: { create: x => x, absoluteFillObject: {} } };
  if (name === 'react-native-reanimated') return { ...reanimated, default: {} };
  if (name.startsWith('@babel/runtime/')) return require(name);
  return {};
}});
moduleObject.exports.testFlight({ task: { x: 20, y: 300, width: 350, height: 110, content: null }, viewportWidth: 390, viewportHeight: 844 });
assert.equal(styles.length, 10);
// Mirrors native mapper input discovery: functions are not traversed. Each
// mapper must capture the clock itself, not just a helper closing over it.
for (const [index, mapper] of styles.entries()) {
  assert.ok(Object.values(mapper.__closure).includes(clock), `Animated style ${index} hides its clock from native mapper subscriptions`);
}
const frame = t => { clock.value = t; return styles.map(mapper => mapper()); };
const a = frame(800), b = frame(950);
assert.notEqual(a[0].transform[0].translateX, b[0].transform[0].translateX, 'sleigh moves continuously during arrival');
assert.notEqual(frame(420)[2].width, frame(600)[2].width, 'wrapping shrinks continuously');
for (const t of [1640, 1750, 1900, 2200]) {
  const [sleigh, gift] = frame(t);
  assert.equal(JSON.stringify(sleigh.transform), JSON.stringify(gift.transform), `gift stays with sleigh at ${t}ms`);
}
console.log('PASS: all 10 native animated styles subscribe to the clock; wrapping and arrival progress; loaded gift stays with sleigh.');
