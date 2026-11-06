import { SvgXml } from 'react-native-svg';

const artwork = `<svg viewBox="0 0 230 150" fill="none" xmlns="http://www.w3.org/2000/svg">
<!-- Santa, seated at the front -->
<path d="M111 92Q110 55 141 56Q165 57 174 94" fill="#C65362"/>
<path d="M139 62v30" stroke="#F6F5ED" stroke-width="9"/>
<path d="M115 85h49" stroke="#352C28" stroke-width="9"/><rect x="135" y="80" width="12" height="10" rx="2" stroke="#E8C478" stroke-width="3"/>
<circle cx="140" cy="40" r="21" fill="#F2C6A0"/>
<path d="M120 40Q112 69 140 74Q167 61 160 40Q151 50 140 48Q128 51 120 40" fill="#F6F5ED"/>
<ellipse cx="140" cy="49" rx="5" ry="4" fill="#EBA88C"/>
<path d="M124 47q7-8 16 1 8-9 16-1" stroke="#FFFDF4" stroke-width="6" stroke-linecap="round"/>
<circle cx="133" cy="39" r="2" fill="#293C34"/><circle cx="149" cy="39" r="2" fill="#293C34"/>
<path d="M139 57q5 4 9-1" stroke="#B85760" stroke-width="2" stroke-linecap="round"/>
<path d="M119 28Q125-3 151 10l18 20-21-10 11 11" fill="#C65362"/>
<path d="M119 29q21-6 40 2" stroke="#F6F5ED" stroke-width="8" stroke-linecap="round"/><circle cx="170" cy="30" r="6" fill="#F6F5ED"/>
<path d="M157 66q12 14 28 6" stroke="#C65362" stroke-width="13" stroke-linecap="round"/><path d="m179 72 6-2" stroke="#F6F5ED" stroke-width="12"/><ellipse cx="189" cy="69" rx="7" ry="5" fill="#E8C478"/>
<!-- Curved sleigh body covers the bottom of the loaded gift -->
<path d="M24 82q10 17 29 17h105q28 0 29-31 0-10 9-10t10 9q0 9-11 10-1 42-35 42H60Q29 119 24 82Z" fill="#AF3B50" stroke="#E8C478" stroke-width="3"/>
<path d="M48 104h111q20 0 26-17" stroke="#E67A87" stroke-width="3" stroke-linecap="round"/>
<path d="M61 119v14m101-16 8 16M31 132h151q30 0 31-18" stroke="#E8C478" stroke-width="5" stroke-linecap="round"/>
<path d="m112 104 2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z" fill="#F4DCA3"/>
</svg>`;

export function SantaSleigh() {
  return <SvgXml xml={artwork} width={230} height={150} />;
}
