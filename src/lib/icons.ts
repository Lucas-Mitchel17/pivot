// Stroke icons drawn with currentColor, so they follow the theme.
const svg = (body: string, vb = "0 0 24 24") =>
  `<svg viewBox="${vb}" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  theme: svg('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>'),
  play: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
  pause:
    '<svg viewBox="0 0 24 24" width="14" height="14"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor"/></svg>',
  stop: '<svg viewBox="0 0 24 24" width="14" height="14"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
  star: svg('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
  starFilled:
    '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  water: svg('<path d="M12 3c3.5 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.5 6-11z"/>'),
  person: svg('<circle cx="12" cy="5" r="2"/><path d="M12 8v6M8 21l4-7 4 7M7 11h10"/>'),
  chevronLeft: svg('<path d="M15 5l-7 7 7 7"/>'),
  chevronRight: svg('<path d="M9 5l7 7-7 7"/>'),
  sound: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>'),
  cube:
    '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="5" width="14" height="14" rx="3" transform="rotate(15 12 12)"/><path d="M17.5 3.5a9.5 9.5 0 0 1 3 4.5" stroke-width="1.8"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>',
};
