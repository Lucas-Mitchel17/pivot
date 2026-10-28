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
