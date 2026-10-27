import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from '../../constants/colors';

// Decorative artwork shared with the approved theme mock-up.
const scene = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 195" fill="none">
          <defs><radialGradient id="halo"><stop stop-color="#b28dd3" stop-opacity=".17"/><stop offset="1" stop-color="#b28dd3" stop-opacity="0"/></radialGradient><linearGradient id="ghost" x1="98" y1="60" x2="151" y2="153" gradientUnits="userSpaceOnUse"><stop stop-color="#fff4de"/><stop offset="1" stop-color="#d6c5e9"/></linearGradient><linearGradient id="pumpkin" x1="137" y1="135" x2="183" y2="178" gradientUnits="userSpaceOnUse"><stop stop-color="#ffb66f"/><stop offset="1" stop-color="#e57840"/></linearGradient></defs>
          <circle cx="118" cy="101" r="90" fill="url(#halo)"/><circle cx="142" cy="42" r="23" fill="#e3c688"/><circle cx="153" cy="33" r="21" fill="${colors.bg}"/><circle cx="65" cy="51" r="1.6" fill="#a18bb5"/><circle cx="173" cy="104" r="1.5" fill="#bba3cd"/><path d="M69 94v8m-4-4h8m99-32v6m-3-3h6M100 27v6m-3-3h6" stroke="#baa1cd" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M54 66c3-9 8-11 12-8l4-6 3 6c5-3 10-1 15 7-8-2-10 2-14 5l-5-1c-4-5-7-7-15-3Z" fill="#7c628e"/><path d="M166 83c3-6 7-7 10-5l3-4 2 4c4-2 7 0 11 5-6-1-8 1-11 3l-4-1c-3-3-6-4-11-2Z" fill="#6b527d"/>
          <ellipse cx="126" cy="169" rx="44" ry="7" fill="#09070e" opacity=".5"/>
          <path d="M94 103c-1-22 9-38 27-38 20 0 32 14 31 36-1 16 4 25 10 35 3 5-4 10-11 6-8-4-10 8-18 7-8-1-8-9-15-7-7 3-10 9-17 4-6-4-7 4-14 0-7-5 5-13 5-27l2-16Z" fill="url(#ghost)"/>
          <ellipse cx="117" cy="101" rx="3.5" ry="5" fill="#37293e"/><ellipse cx="136" cy="100" rx="3.5" ry="5" fill="#37293e"/><path d="M123 110q5 6 9-1" stroke="#6e526c" stroke-width="2" stroke-linecap="round"/><ellipse cx="108" cy="109" rx="5" ry="2.6" fill="#e8b1ae" opacity=".6"/><ellipse cx="143" cy="108" rx="5" ry="2.6" fill="#e8b1ae" opacity=".6"/>
          <path d="M160 143q-5-9 1-15" stroke="#91a184" stroke-width="5" stroke-linecap="round"/><path d="M163 133q9-9 16-3-4 8-16 3Z" fill="#96ad86"/><ellipse cx="164" cy="158" rx="27" ry="21" fill="url(#pumpkin)"/><ellipse cx="164" cy="158" rx="16" ry="21" stroke="#cf673a" stroke-opacity=".55" stroke-width="1.5"/><path d="m151 155 7-6 2 8-9-2Zm17 1 3-8 7 6-10 2Zm-13 7q10 9 20-1l-3 1-3-2-3 4-4-3-3 2-4-1Z" fill="#663824"/><path d="M77 163q8-5 10 3-9 6-10-3Z" fill="#8c6b98"/><path d="M70 157q8-1 7 7-9 1-7-7Z" fill="#b28cc0"/><path d="m77 166-4 6" stroke="#8c6b98" stroke-width="1.5"/>
        </svg>`;
const web = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none"><g stroke="${colors.priorityB}" stroke-width=".85" stroke-linecap="round"><path d="M0 0h114M0 0l106 44M0 0l81 81M0 0l44 106M0 0v114"/><path d="M28 0Q22 5 26 11Q20 13 20 20Q13 20 11 26Q5 22 0 28M56 0Q45 10 52 21Q39 27 40 40Q27 39 21 52Q10 45 0 56M84 0Q68 15 78 32Q59 40 60 60Q40 59 32 78Q15 68 0 84M112 0Q90 20 104 43Q79 54 79 79Q54 79 43 104Q20 90 0 112"/></g></svg>`;

interface Props {
  style?: StyleProp<ViewStyle>;
}

export function HalloweenArtwork({ style }: Props) {
  return (
    <View style={style} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SvgXml xml={scene} width={196} height={183} />
    </View>
  );
}

export function Cobweb({ style }: Props) {
  return (
    <View style={style} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SvgXml xml={web} width="100%" height="100%" />
    </View>
  );
}

export function ViewportCobwebs() {
  return (
    <View style={styles.overlay} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="viewport-cobwebs">
      <Cobweb style={styles.left} />
      <Cobweb style={styles.right} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 5 },
  left: { position: 'absolute', top: 0, left: 0, width: 100, height: 100, opacity: 0.4 },
  right: { position: 'absolute', top: 0, right: 0, width: 86, height: 86, opacity: 0.3, transform: [{ scaleX: -1 }] },
});
