// Lucas Mitchel Dev lockup (mitchel-design-system/assets/logo/lucas-mitchel-dev-mark-lockup.svg)
// with the ice → blue gradient. Inline so the stops read --brand-mark-from/-to
// and follow light/dark mode.
export const LOGO_LOCKUP = `<svg viewBox="0 0 288 170" width="34" height="20" role="img" aria-label="Lucas Mitchel Dev">
<defs>
<linearGradient id="lmd-grad" x1="236" y1="7" x2="60" y2="170" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="var(--brand-mark-from, #7de3ff)"/><stop offset="1" stop-color="var(--brand-mark-to, #3f6bff)"/>
</linearGradient>
<mask id="lmd-knock" maskUnits="userSpaceOnUse" x="0" y="0" width="288" height="170">
<rect x="0" y="0" width="288" height="170" fill="#fff"/>
<g fill="#000" stroke="#000" stroke-width="9" stroke-linejoin="round">
<path d="M215 7 L236 7 L169 113 L158 111 L134 73 L132 120 L114 120 L114 36 L133 37 L164 87 Z"/>
<path d="M239 22 L238 37 L196 152 L175 152 L198 89 Z"/>
</g>
</mask>
</defs>
<g fill="url(#lmd-grad)">
<g mask="url(#lmd-knock)">
<path d="M66 44 L66 68 L38 88 L66 108 L66 132 L4 96 L4 80 Z"/>
<path d="M222 44 L222 68 L250 88 L222 108 L222 132 L284 96 L284 80 Z"/>
</g>
<path d="M78 35 H97 V134 H166 L157 152 H78 Z"/>
<path d="M215 7 L236 7 L169 113 L158 111 L134 73 L132 120 L114 120 L114 36 L133 37 L164 87 Z"/>
<path d="M239 22 L238 37 L196 152 L175 152 L198 89 Z"/>
</g>
</svg>`;

// Pivot app mark (assets/app-icon.svg). Fixed colors so it matches the dock icon in both modes.
export const PIVOT_MARK = `<svg viewBox="64 64 896 896" width="26" height="26" aria-hidden="true">
<defs><linearGradient id="pivot-mark-grad" x1="900" y1="80" x2="120" y2="960" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#7de3ff"/><stop offset="1" stop-color="#3f6bff"/></linearGradient></defs>
<rect x="64" y="64" width="896" height="896" rx="200" fill="url(#pivot-mark-grad)"/>
<rect x="272" y="272" width="480" height="480" rx="96" transform="rotate(15 512 512)" fill="none" stroke="#05070e" stroke-width="64" stroke-linejoin="round"/>
<path d="M760 168a330 330 0 0 1 104 156" fill="none" stroke="#05070e" stroke-width="52" stroke-linecap="round"/>
<circle cx="512" cy="512" r="64" fill="#05070e"/>
</svg>`;
