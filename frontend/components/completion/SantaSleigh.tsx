import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path, SvgXml } from 'react-native-svg';
import { smoothSample, springImpulse } from './christmasMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const svg = (content: string) => `<svg viewBox="0 0 230 150" fill="none" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
const torso = svg(`<path d="M111 92Q110 55 141 56Q165 57 174 94" fill="#C65362"/>
<path d="M139 62v30" stroke="#F6F5ED" stroke-width="9"/>
<path d="M115 85h49" stroke="#352C28" stroke-width="9"/><rect x="135" y="80" width="12" height="10" rx="2" stroke="#E8C478" stroke-width="3"/>`);
const face = svg(`<circle cx="140" cy="40" r="21" fill="#F2C6A0"/>
<path d="M120 40Q112 69 140 74Q167 61 160 40Q151 50 140 48Q128 51 120 40" fill="#F6F5ED"/>
<ellipse cx="140" cy="49" rx="5" ry="4" fill="#EBA88C"/>
<path d="M124 47q7-8 16 1 8-9 16-1" stroke="#FFFDF4" stroke-width="6" stroke-linecap="round"/>
<path d="M139 57q5 4 9-1" stroke="#B85760" stroke-width="2" stroke-linecap="round"/>`);
const eyes = svg('<circle cx="133" cy="39" r="2" fill="#293C34"/><circle cx="149" cy="39" r="2" fill="#293C34"/>');
const hat = svg(`<path d="M119 28Q125-3 151 10l18 20-21-10 11 11" fill="#C65362"/>
<circle cx="170" cy="30" r="6" fill="#F6F5ED"/>`);
const brim = svg('<path d="M119 29q21-6 40 2" stroke="#F6F5ED" stroke-width="8" stroke-linecap="round"/>');
const arm = svg(`<path d="M157 66q12 14 28 6" stroke="#C65362" stroke-width="13" stroke-linecap="round"/>
<path d="m179 72 6-2" stroke="#F6F5ED" stroke-width="12"/><ellipse cx="189" cy="69" rx="7" ry="5" fill="#E8C478"/>`);
const hull = svg(`<path d="M24 82q10 17 29 17h105q28 0 29-31 0-10 9-10t10 9q0 9-11 10-1 42-35 42H60Q29 119 24 82Z" fill="#AF3B50" stroke="#E8C478" stroke-width="3"/>
<path d="M48 104h111q20 0 26-17" stroke="#E67A87" stroke-width="3" stroke-linecap="round"/>
<path d="M61 119v14m101-16 8 16M31 132h151q30 0 31-18" stroke="#E8C478" stroke-width="5" stroke-linecap="round"/>
<path d="m112 104 2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z" fill="#F4DCA3"/>`);

// Rigid runners and hull; Santa and the cloth lag behind each impact.
export function SantaSleigh({ time }: { time: SharedValue<number> }) {
  const body = useAnimatedStyle(() => ({ transform: [
    { translateY: springImpulse(time.value, 1080, -3, 22, 8) + springImpulse(time.value, 1515, 6, 24, 9) },
    { rotate: `${springImpulse(time.value, 1080, 8, 22, 8) + springImpulse(time.value, 1515, -5, 24, 9)
      + smoothSample(time.value, [1700, 1900, 2300], [0, -6, -3])}deg` },
  ] }));
  const head = useAnimatedStyle(() => ({ transform: [
    { translateY: springImpulse(time.value, 1540, 3, 25, 9) },
    { rotate: `${springImpulse(time.value, 1100, 6, 20, 8) + springImpulse(time.value, 1540, 7, 25, 8)}deg` },
  ] }));
  const cap = useAnimatedStyle(() => ({ transform: [
    { rotate: `${springImpulse(time.value, 1110, -13, 19, 7) + springImpulse(time.value, 1560, 17, 23, 7)
      + smoothSample(time.value, [1770, 2070], [0, -12])}deg` },
  ] }));
  const blink = useAnimatedStyle(() => ({ transform: [
    { scaleY: smoothSample(time.value, [1170, 1210, 1270], [1, 0.1, 1]) },
  ] }));
  const hand = useAnimatedStyle(() => ({ transform: [
    { rotate: `${smoothSample(time.value, [900, 1080, 1260, 1680, 1780, 1940], [7, -8, 0, 0, -14, -5])
      + springImpulse(time.value, 1530, 5, 24, 9)}deg` },
  ] }));
  // Follow the glove's transformed position; keep the other end on the sleigh.
  const reins = useAnimatedProps(() => {
    const t = time.value;
    const bodyY = springImpulse(t, 1080, -3, 22, 8) + springImpulse(t, 1515, 6, 24, 9);
    const bodyAngle = (springImpulse(t, 1080, 8, 22, 8) + springImpulse(t, 1515, -5, 24, 9)
      + smoothSample(t, [1700, 1900, 2300], [0, -6, -3])) * Math.PI / 180;
    const armAngle = (smoothSample(t, [900, 1080, 1260, 1680, 1780, 1940], [7, -8, 0, 0, -14, -5])
      + springImpulse(t, 1530, 5, 24, 9)) * Math.PI / 180;
    const localX = 157 + 32 * Math.cos(armAngle) - 3 * Math.sin(armAngle);
    const localY = 66 + 32 * Math.sin(armAngle) + 3 * Math.cos(armAngle);
    const x = 140 + (localX - 140) * Math.cos(bodyAngle) - (localY - 88) * Math.sin(bodyAngle);
    const y = 88 + bodyY + (localX - 140) * Math.sin(bodyAngle) + (localY - 88) * Math.cos(bodyAngle);
    const slack = smoothSample(t, [1680, 1780, 1940], [15, 3, 8])
      + springImpulse(t, 1080, 5, 26, 8) + springImpulse(t, 1530, 6, 27, 9);
    return { d: `M${x} ${y} Q223 ${80 + slack} 199 80 M${x + 2} ${y + 3} Q225 ${84 + slack} 201 83` };
  });

  return <View style={styles.layer}>
    <Svg style={styles.layer} width={230} height={150} viewBox="0 0 230 150">
      <AnimatedPath testID="santa-reins" animatedProps={reins} fill="none" stroke="#E8C478" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
    <Animated.View testID="santa-body" style={[styles.layer, styles.bodyPivot, body]}>
      <SvgXml xml={torso} width={230} height={150} />
      <Animated.View testID="santa-head" style={[styles.layer, styles.headPivot, head]}>
        <SvgXml xml={face} width={230} height={150} />
        <Animated.View style={[styles.layer, styles.eyesPivot, blink]}><SvgXml xml={eyes} width={230} height={150} /></Animated.View>
        <Animated.View testID="santa-hat" style={[styles.layer, styles.hatPivot, cap]}><SvgXml xml={hat} width={230} height={150} /></Animated.View>
        <View style={styles.layer}><SvgXml xml={brim} width={230} height={150} /></View>
      </Animated.View>
      <Animated.View testID="santa-arm" style={[styles.layer, styles.armPivot, hand]}><SvgXml xml={arm} width={230} height={150} /></Animated.View>
    </Animated.View>
    <View style={styles.layer}><SvgXml xml={hull} width={230} height={150} /></View>
  </View>;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', width: 230, height: 150 },
  bodyPivot: { transformOrigin: '140px 88px' },
  headPivot: { transformOrigin: '140px 60px' },
  hatPivot: { transformOrigin: '139px 28px' },
  armPivot: { transformOrigin: '157px 66px' },
  eyesPivot: { transformOrigin: '140px 39px' },
});
