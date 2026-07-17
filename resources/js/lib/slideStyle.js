// Single source of truth for the default slide base styling shared by the
// editor canvas (shadow DOM) and the standalone preview document served by
// the `embed=1` endpoint. Keep these in sync with the backend document in
// app/Http/Controllers/Api/V1/SlideController.php::htmlByFile.
export const SLIDE_BG = "#fff";
export const SLIDE_COLOR = "#1e1e1e";
export const SLIDE_FONT = '"Inter",system-ui,-apple-system,sans-serif';

const SLIDE_FONT_CSS = (font) => `font-family:${font};`;

// Base CSS scoped to `.slide` (NOT `*`) so colour/font *inherit* to descendants
// and children can override via the cascade. A `*` rule would apply `color`
// directly to every element and break inheritance from a parent's inline style.
export const BASE_CSS = `.slide{background:${SLIDE_BG};color:${SLIDE_COLOR};${SLIDE_FONT_CSS(SLIDE_FONT)}}
ul,ol{margin:0;padding-left:1.4em}
li{margin:0}`;
