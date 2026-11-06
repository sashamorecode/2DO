import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

// Vector artwork stays crisp at every density and ships with the OTA bundle.
const scene = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 195" fill="none">
  <defs>
    <radialGradient id="glow"><stop stop-color="#A4D4B4" stop-opacity=".16"/><stop offset="1" stop-color="#A4D4B4" stop-opacity="0"/></radialGradient>
    <linearGradient id="snow" x1="107" y1="80" x2="158" y2="176" gradientUnits="userSpaceOnUse"><stop stop-color="#FFFFFF"/><stop offset="1" stop-color="#C4DFE4"/></linearGradient>
  </defs>
  <circle cx="124" cy="103" r="90" fill="url(#glow)"/>
  <ellipse cx="125" cy="176" rx="69" ry="9" fill="#B4D9EA" opacity=".13"/>
  <path d="M79 153v20" stroke="#987552" stroke-width="8" stroke-linecap="round"/>
  <path d="m79 48-23 39h12l-23 34h17l-27 37h87l-27-37h17L90 87h12L79 48Z" fill="#34705A"/>
  <path d="m79 48-23 39h12l11-9 11 9h12L79 48Z" fill="#549477"/>
  <path d="m57 114 11 5 11-6 12 6 11-5M49 148l14 5 16-6 16 6 15-5" stroke="#CDE5DA" stroke-width="3" stroke-linecap="round"/>
  <path d="m79 37 3.5 8 8.5 1-6.5 6 2 8-7.5-4.5-7.5 4.5 2-8-6.5-6 8.5-1L79 37Z" fill="#F4DCA3"/>
  <circle cx="76" cy="94" r="3" fill="#F4DCA3"/><circle cx="62" cy="135" r="3.5" fill="#E77982"/><circle cx="93" cy="135" r="3" fill="#F4DCA3"/>
  <path d="m112 126-18-15m5 4-1-10m61 21 21-15m-8 6 1-11" stroke="#B59A72" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="138" cy="148" rx="30" ry="28" fill="url(#snow)"/>
  <circle cx="136" cy="106" r="22" fill="url(#snow)"/>
  <path d="M116 91q3-32 27-31l16 21-16-7-3 17Z" fill="#C65362"/>
  <path d="M116 91q21-6 40-1" stroke="#F6F5ED" stroke-width="9" stroke-linecap="round"/>
  <circle cx="159" cy="81" r="6" fill="#F6F5ED"/>
  <circle cx="128" cy="104" r="2.3" fill="#214038"/><circle cx="143" cy="104" r="2.3" fill="#214038"/>
  <path d="m135 108 12 4-12 3Z" fill="#E9A15B"/>
  <path d="M128 116q7 6 14 0" stroke="#527569" stroke-width="1.8" stroke-linecap="round"/>
  <ellipse cx="120" cy="112" rx="4" ry="2" fill="#EAA2AA" opacity=".6"/>
  <path d="M119 124q17 8 34-1" stroke="#C65362" stroke-width="9" stroke-linecap="round"/>
  <path d="m146 127 4 19 9-3-6-20" fill="#C65362"/>
  <path d="m150 138 7-2" stroke="#ECA1A8" stroke-width="2"/>
  <circle cx="135" cy="141" r="2.3" fill="#527569"/><circle cx="136" cy="153" r="2.3" fill="#527569"/>
  <rect x="170" y="153" width="23" height="22" rx="3" fill="#C65362"/>
  <path d="M181 153v22m-11-15h23" stroke="#F4DCA3" stroke-width="3"/>
  <path d="M181 153c-13-1-11-12-5-8l5 8Zm0 0c13-1 11-12 5-8l-5 8Z" stroke="#F4DCA3" stroke-width="2"/>
  <path d="M174 48v10m-5-5h10M110 34v6m-3-3h6M49 78v6m-3-3h6" stroke="#B4D9EA" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="188" cy="106" r="2" fill="#DDEEEF"/><circle cx="106" cy="63" r="1.5" fill="#DDEEEF"/><circle cx="55" cy="47" r="1.5" fill="#DDEEEF"/>
</svg>`;

export function ChristmasArtwork({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SvgXml xml={scene} width={196} height={183} />
    </View>
  );
}
