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
const motionModule = { exports: {} };
const motionCode = babel.transformFileSync(path.join(base, 'components/completion/christmasMotion.ts'), {
  configFile: false, babelrc: false,
  presets: [[require.resolve('babel-preset-expo'), { jsxRuntime: 'classic' }]],
  plugins: [require.resolve('react-native-worklets/plugin')],
  caller: { name: 'metro', platform: 'android', isDev: false },
}).code;
vm.runInNewContext(motionCode, { global: { Error }, exports: motionModule.exports, module: motionModule, require });
const motion = motionModule.exports;
const moduleObject = { exports: {} };
vm.runInNewContext(code, { global: { Error }, exports: moduleObject.exports, module: moduleObject, require: name => {
  if (name === 'react') return { ...react, default: react };
  if (name === 'react-native') return { StyleSheet: { create: x => x, absoluteFillObject: {} } };
  if (name === 'react-native-reanimated') return { ...reanimated, default: {} };
  if (name === './christmasMotion') return motion;
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
for (const t of [1490, 1540, 1640, 1750, 1900, 2200]) {
  const [sleigh, gift] = frame(t);
  assert.equal(JSON.stringify(sleigh.transform), JSON.stringify(gift.transform), `gift stays with sleigh at ${t}ms`);
}
console.log('PASS: all 10 native animated styles subscribe to the clock; wrapping and arrival progress; loaded gift stays with sleigh.');

assert.equal(motion.springImpulse(1489, 1490, 14), 0, 'no suspension movement before contact');
assert.equal(motion.springImpulse(1490, 1490, 14), 0, 'impact position is continuous');
assert.ok(motion.springImpulse(1540, 1490, 14) > 0, 'sleigh dips under the load');
assert.ok(motion.springImpulse(1675, 1490, 14) < 0, 'suspension rebounds');
assert.ok(Math.abs(motion.springImpulse(1805, 1490, 14)) < Math.abs(motion.springImpulse(1540, 1490, 14)), 'bounce loses energy');
assert.equal(motion.giftRebound(1490), 0);
assert.ok(motion.giftRebound(1580) > 0);
assert.equal(motion.giftRebound(1670), 0, 'gift returns to cargo floor');
const falling = [1320, 1380, 1440].map(t => frame(t)[2].top);
assert.ok(falling[2] - falling[1] > falling[1] - falling[0], 'gift accelerates downwards');

// Secondary motion must subscribe directly too: hiding this clock previously
// froze the production animation, even though the bundle compiled successfully.
const santaFilename = path.join(base, 'components/completion/SantaSleigh.tsx');
const santaCode = babel.transformFileSync(santaFilename, {
  configFile: false, babelrc: false,
  presets: [[require.resolve('babel-preset-expo'), { jsxRuntime: 'classic' }]],
  plugins: [require.resolve('react-native-worklets/plugin')],
  caller: { name: 'metro', platform: 'android', isDev: false },
}).code;
const santaModule = { exports: {} }, santaStyles = [], santaProps = [];
vm.runInNewContext(santaCode, { global: { Error }, React: react, exports: santaModule.exports, module: santaModule, require: name => {
  if (name === 'react-native') return { StyleSheet: { create: x => x } };
  if (name === 'react-native-reanimated') {
    const api = { createAnimatedComponent: x => x, useAnimatedStyle: fn => { santaStyles.push(fn); return {}; }, useAnimatedProps: fn => { santaProps.push(fn); return {}; } };
    return { ...api, default: api };
  }
  if (name === './christmasMotion') return motion;
  if (name.startsWith('@babel/runtime/')) return require(name);
  return {};
}});
santaModule.exports.SantaSleigh({ time: clock });
assert.equal(santaStyles.length, 5);
assert.equal(santaProps.length, 1);
for (const mapper of [...santaStyles, ...santaProps]) assert.ok(Object.values(mapper.__closure).includes(clock), 'Santa mapper reads the clock directly');
clock.value = 1540;
const before = [...santaStyles, ...santaProps].map(fn => JSON.stringify(fn()));
clock.value = 1610;
const after = [...santaStyles, ...santaProps].map(fn => JSON.stringify(fn()));
for (const i of [0, 1, 2, 4, 5]) assert.notEqual(before[i], after[i], `Santa attachment ${i} follows through`);
console.log('PASS: damped impact, gravity, cargo rebound and all six Santa motion subscriptions.');
