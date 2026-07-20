#!/usr/bin/env node
/**
 * scripts/fonts.mjs
 *
 * Downloads a curated whitelist of modern, free (OFL/Apache) fonts from
 * Bunny Fonts — a privacy-friendly mirror of Google Fonts — and serves them
 * locally under `public/fonts/`. The catalog of available fonts is generated
 * to `resources/js/editor/fonts.config.js` and the matching `@font-face`
 * stylesheet is written to `public/fonts/fonts.css`. Together these are the
 * SINGLE source of truth for the slide editor's font picker.
 *
 * Why local: the slide canvas lives inside a Shadow DOM, the preview opens
 * as a `blob:` URL, and the embed endpoint renders off-origin — none of them
 * can rely on a CDN link at runtime. By bundling the fonts as static assets
 * served from the app itself, slides render identically with no network
 * dependency on Google Fonts.
 *
 * Usage:
 *   npm run fonts        # download + regenerate catalog + write fonts.css
 *   npm run fonts:check  # verify catalog + woff2 files match the whitelist
 *
 * To add / remove / change a font:
 *   1. Edit the FONTS whitelist below (and weights per font as desired).
 *   2. Run `npm run fonts` — missing files are downloaded, the catalog and
 *      `public/fonts/fonts.css` are regenerated.
 *   3. Commit `fonts.config.js`, `public/fonts/fonts.css`, and any new
 *      `public/fonts/*.woff2` files.
 *
 * NEVER hand-edit `resources/js/editor/fonts.config.js` or
 * `public/fonts/fonts.css` — they are derived.
 */
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {basename, dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FONTS_DIR = join(ROOT, "public", "fonts");
const OUT_CATALOG = join(ROOT, "resources", "js", "editor", "fonts.config.js");
const OUT_CSS = join(FONTS_DIR, "fonts.css");
const BUNNY_BASE = "https://fonts.bunny.net";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

/**
 * Whitelist of modern, popular, free fonts (OFL or Apache licensed) plus
 * the standard system fonts. Each entry drives what the script downloads
 * and what appears in the FontSelector UI.
 *
 * - `family`:   the human-readable name used as `font-family` value and as
 *               the option label in the picker.
 * - `slug`:     the Bunny Fonts font id (matches the URL segment under
 *               `fonts.bunny.net/{slug}`). Omit for system fonts.
 * - `category`: picker grouping (sans | serif | mono | display | script |
 *               system).
 * - `weights`:  the weights to fetch. Display/script fonts often ship only
 *               400; the script silently skips weights the source doesn't
 *               have (Bunny returns no @font-face for them).
 * - `stack`:    the full CSS `font-family` value written into inline styles
 *               on slide elements. Always includes a robust fallback chain
 *               so text remains readable if the primary font fails.
 * - `system`:   `true` means the font is provided by the OS and never
 *               downloaded — no `@font-face` is emitted for it.
 */
const FONTS = [
    // Sans-Serif — modern, popular, versatile
    {family: "Inter", slug: "inter", category: "sans", weights: [400, 500, 600, 700], stack: '"Inter",system-ui,-apple-system,sans-serif'},
    {family: "Roboto", slug: "roboto", category: "sans", weights: [400, 500, 700], stack: '"Roboto",system-ui,-apple-system,sans-serif'},
    {family: "Open Sans", slug: "open-sans", category: "sans", weights: [400, 600, 700], stack: '"Open Sans",system-ui,-apple-system,sans-serif'},
    {family: "Poppins", slug: "poppins", category: "sans", weights: [400, 500, 600, 700], stack: '"Poppins",system-ui,sans-serif'},
    {family: "Montserrat", slug: "montserrat", category: "sans", weights: [400, 500, 600, 700], stack: '"Montserrat",system-ui,sans-serif'},
    {family: "Lato", slug: "lato", category: "sans", weights: [400, 700], stack: '"Lato",system-ui,sans-serif'},
    {family: "Raleway", slug: "raleway", category: "sans", weights: [400, 600, 700], stack: '"Raleway",system-ui,sans-serif'},
    {family: "Manrope", slug: "manrope", category: "sans", weights: [400, 500, 700], stack: '"Manrope",system-ui,sans-serif'},
    {family: "Space Grotesk", slug: "space-grotesk", category: "sans", weights: [400, 500, 700], stack: '"Space Grotesk",system-ui,sans-serif'},
    {family: "DM Sans", slug: "dm-sans", category: "sans", weights: [400, 500, 700], stack: '"DM Sans",system-ui,sans-serif'},
    {family: "Work Sans", slug: "work-sans", category: "sans", weights: [400, 500, 700], stack: '"Work Sans",system-ui,sans-serif'},
    {family: "Nunito", slug: "nunito", category: "sans", weights: [400, 600, 700], stack: '"Nunito",system-ui,sans-serif'},
    {family: "IBM Plex Sans", slug: "ibm-plex-sans", category: "sans", weights: [400, 500, 700], stack: '"IBM Plex Sans",system-ui,sans-serif'},
    {family: "Karla", slug: "karla", category: "sans", weights: [400, 700], stack: '"Karla",system-ui,sans-serif'},
    {family: "Mulish", slug: "mulish", category: "sans", weights: [400, 700], stack: '"Mulish",system-ui,sans-serif'},
    {family: "Archivo", slug: "archivo", category: "sans", weights: [400, 500, 700], stack: '"Archivo",system-ui,sans-serif'},

    // Serif — elegant, editorial
    {family: "Playfair Display", slug: "playfair-display", category: "serif", weights: [400, 500, 700], stack: '"Playfair Display",Georgia,serif'},
    {family: "Merriweather", slug: "merriweather", category: "serif", weights: [400, 700], stack: '"Merriweather",Georgia,serif'},
    {family: "Lora", slug: "lora", category: "serif", weights: [400, 500, 700], stack: '"Lora",Georgia,serif'},
    {family: "Source Serif 4", slug: "source-serif-4", category: "serif", weights: [400, 600, 700], stack: '"Source Serif 4",Georgia,serif'},
    {family: "IBM Plex Serif", slug: "ibm-plex-serif", category: "serif", weights: [400, 500, 700], stack: '"IBM Plex Serif",Georgia,serif'},
    {family: "Cormorant Garamond", slug: "cormorant-garamond", category: "serif", weights: [400, 500, 700], stack: '"Cormorant Garamond",Georgia,serif'},

    // Monospace — code, terminal vibe
    {family: "JetBrains Mono", slug: "jetbrains-mono", category: "mono", weights: [400, 500, 700], stack: '"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace'},
    {family: "Fira Code", slug: "fira-code", category: "mono", weights: [400, 500, 700], stack: '"Fira Code",ui-monospace,SFMono-Regular,Menlo,monospace'},
    {family: "IBM Plex Mono", slug: "ibm-plex-mono", category: "mono", weights: [400, 500, 700], stack: '"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace'},
    {family: "Source Code Pro", slug: "source-code-pro", category: "mono", weights: [400, 600, 700], stack: '"Source Code Pro",ui-monospace,SFMono-Regular,Menlo,monospace'},

    // Display / Condensed — headlines, posters
    {family: "Bebas Neue", slug: "bebas-neue", category: "display", weights: [400], stack: '"Bebas Neue",Impact,sans-serif'},
    {family: "Oswald", slug: "oswald", category: "display", weights: [400, 500, 700], stack: '"Oswald",system-ui,sans-serif'},
    {family: "Anton", slug: "anton", category: "display", weights: [400], stack: '"Anton",Impact,sans-serif'},
    {family: "Archivo Black", slug: "archivo-black", category: "display", weights: [400], stack: '"Archivo Black",Impact,sans-serif'},

    // Script / Handwriting — accent, signature
    {family: "Pacifico", slug: "pacifico", category: "script", weights: [400], stack: '"Pacifico",cursive'},
    {family: "Caveat", slug: "caveat", category: "script", weights: [400, 700], stack: '"Caveat",cursive'},
    {family: "Satisfy", slug: "satisfy", category: "script", weights: [400], stack: '"Satisfy",cursive'},

    // System fonts — provided by the OS, never downloaded
    {family: "System UI", category: "system", weights: [400], stack: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", system: true},
    {family: "Arial", category: "system", weights: [400], stack: "Arial,Helvetica,sans-serif", system: true},
    {family: "Helvetica", category: "system", weights: [400], stack: "Helvetica,Arial,sans-serif", system: true},
    {family: "Georgia", category: "system", weights: [400], stack: "Georgia,'Times New Roman',serif", system: true},
    {family: "Times New Roman", category: "system", weights: [400], stack: "'Times New Roman',Times,serif", system: true},
    {family: "Courier New", category: "system", weights: [400], stack: "'Courier New',Courier,monospace", system: true},
    {family: "Verdana", category: "system", weights: [400], stack: "Verdana,Geneva,sans-serif", system: true},
    {family: "Tahoma", category: "system", weights: [400], stack: "Tahoma,Geneva,sans-serif", system: true},
    {family: "Trebuchet MS", category: "system", weights: [400], stack: "'Trebuchet MS',Helvetica,sans-serif", system: true},
    {family: "Impact", category: "system", weights: [400], stack: "Impact,Haettenschweiler,sans-serif", system: true},
];

// Subsets we bother fetching. `latin` covers pt_BR + Western European;
// `latin-ext` adds Eastern European + extras — both are tiny and worth
// keeping for full coverage of accented characters.
const SUBSETS = new Set(["latin", "latin-ext"]);

const checkOnly = process.argv.includes("--check");

function fail(msg, code = 1) {
    console.error(`scripts/fonts: ${msg}`);
    process.exit(code);
}

function uniq(arr) {
    return [...new Set(arr)];
}

function bunnyCssUrl(slug, weights) {
    const weightSpec = uniq(weights).sort((a, b) => a - b).join(";");
    return `${BUNNY_BASE}/css2?family=${slug}:wght@${weightSpec}&display=swap`;
}

/**
 * Fetch the @font-face CSS for one family + set of weights from Bunny Fonts.
 * Uses a realistic User-Agent so the CDN serves modern woff2.
 */
async function fetchFamilyCss(slug, weights) {
    const url = bunnyCssUrl(slug, weights);
    const res = await fetch(url, {headers: {"User-Agent": UA}});
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return res.text();
}

/**
 * Parse a chunk of @font-face CSS and return one entry per face, limited to
 * the subsets we care about (latin + latin-ext). Each entry has the woff2
 * URL, family name, weight, style and subset name.
 */
function parseFaces(css, family) {
    const blocks = css.match(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{[^}]*}/g) || [];
    const out = [];
    for (const block of blocks) {
        const subsetMatch = block.match(/\/\*\s*([\w-]+)\s*\*\//);
        const subset = subsetMatch ? subsetMatch[1] : "latin";
        if (!SUBSETS.has(subset)) continue;

        const urlMatch = block.match(/url\((https:\/\/[^)]+\.woff2)\)/);
        if (!urlMatch) continue;
        const url = urlMatch[1];

        const weightMatch = block.match(/font-weight:\s*(\d+)/);
        const weight = weightMatch ? Number(weightMatch[1]) : 400;

        const styleMatch = block.match(/font-style:\s*(\w+)/);
        const style = styleMatch ? styleMatch[1] : "normal";

        const unicodeMatch = block.match(/unicode-range:\s*([^;]+);/);
        const unicodeRange = unicodeMatch ? unicodeMatch[1].trim() : null;

        out.push({family, subset, weight, style, url, unicodeRange});
    }
    return out;
}

/**
 * Convert a Bunny CDN woff2 URL like
 *   https://fonts.bunny.net/inter/files/inter-latin-400-normal.woff2
 * into the local filename we store under public/fonts/. The remote filename
 * is already `<slug>-<subset>-<weight>-<style>.woff2` — collision-free across
 * fonts because the slug is part of the name.
 */
function localFilename(face) {
    return basename(face.url);
}

async function downloadFile(url, destPath, overwrite = false) {
    if (!overwrite && existsSync(destPath)) {
        return "skip";
    }
    const res = await fetch(url, {headers: {"User-Agent": UA}});
    if (!res.ok) {
        return `fail:${res.status}`;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    mkdirSync(dirname(destPath), {recursive: true});
    writeFileSync(destPath, buf);
    return "ok";
}

/**
 * Build the @font-face CSS string. `baseUrl` is prepended to each url(...)
 * (empty string for relative `/fonts/...` paths).
 */
function buildFontFaceCss(faces, baseUrl = "") {
    const lines = [
        "/* AUTO-GENERATED by scripts/fonts.mjs — DO NOT EDIT BY HAND. */",
        "/* Local @font-face declarations for the slide editor. Served from",
        "   public/fonts/ — same origin in dev and prod. Every weight of every",
        "   curated font is loaded eagerly so the editor's font picker shows",
        "   accurate previews and the Shadow DOM / preview / embed docs all",
        "   resolve the same families. */",
        "",
    ];
    const prefix = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    for (const face of faces) {
        const path = `${prefix}/fonts/${face.file}`;
        lines.push("@font-face {");
        lines.push(`  font-family: '${face.family}';`);
        lines.push(`  font-style: ${face.style};`);
        lines.push(`  font-weight: ${face.weight};`);
        lines.push("  font-display: swap;");
        lines.push(`  src: url(${path}) format('woff2');`);
        if (face.unicodeRange) {
            lines.push(`  unicode-range: ${face.unicodeRange};`);
        }
        lines.push("}");
        lines.push("");
    }
    return lines.join("\n");
}

/**
 * Build the JS catalog module — `FONT_CATALOG` (metadata for the picker) and
 * `FONT_FACE_CSS` (string for runtime injection when /fonts/fonts.css cannot
 * be linked — e.g. inside a blob: preview document).
 */
function buildCatalogModule(entries, fontsCss, hash) {
    const entryLines = entries.map((e) => {
        const weights = JSON.stringify(e.weights);
        return (
            `  {\n` +
            `    family: ${JSON.stringify(e.family)},\n` +
            `    category: ${JSON.stringify(e.category)},\n` +
            `    stack: ${JSON.stringify(e.stack)},\n` +
            `    weights: ${weights},\n` +
            `    system: ${e.system ? "true" : "false"},\n` +
            `  }`
        );
    });

    return (
        `// AUTO-GENERATED — DO NOT EDIT.\n` +
        `// Regenerated by \`npm run fonts\` (scripts/fonts.mjs).\n` +
        `// Source: Bunny Fonts (https://fonts.bunny.net) — OFL / Apache licensed.\n` +
        `// Local files: public/fonts/*.woff2 + public/fonts/fonts.css (sha256 ${hash.slice(0, 12)}).\n` +
        `//\n` +
        `// To add, remove, or change a font, update the FONTS whitelist in\n` +
        `// scripts/fonts.mjs then run the script and commit:\n` +
        `//   - this file,\n` +
        `//   - public/fonts/fonts.css,\n` +
        `//   - and any new public/fonts/*.woff2 binaries.\n` +
        `\n` +
        `export const FONT_CATALOG_VERSION = ${JSON.stringify(hash.slice(0, 12))};\n` +
        `\n` +
        `export const FONT_CATEGORY_SANS = "sans";\n` +
        `export const FONT_CATEGORY_SERIF = "serif";\n` +
        `export const FONT_CATEGORY_MONO = "mono";\n` +
        `export const FONT_CATEGORY_DISPLAY = "display";\n` +
        `export const FONT_CATEGORY_SCRIPT = "script";\n` +
        `export const FONT_CATEGORY_SYSTEM = "system";\n` +
        `\n` +
        `// Groupings shown by <FontSelector>. \`labelKey\` is resolved with __()\n` +
        `// from lang/{locale}/messages.php (see the \`fonts\` section).\n` +
        `export const FONT_CATEGORIES = [\n` +
        `  {id: "sans", labelKey: "messages.fonts.category_sans", order: 1},\n` +
        `  {id: "serif", labelKey: "messages.fonts.category_serif", order: 2},\n` +
        `  {id: "mono", labelKey: "messages.fonts.category_mono", order: 3},\n` +
        `  {id: "display", labelKey: "messages.fonts.category_display", order: 4},\n` +
        `  {id: "script", labelKey: "messages.fonts.category_script", order: 5},\n` +
        `  {id: "system", labelKey: "messages.fonts.category_system", order: 6},\n` +
        `];\n` +
        `\n` +
        `// Font entries used by the picker. \`system: true\` means the font is\n` +
        `// provided by the OS and has no @font-face below.\n` +
        `export const FONT_CATALOG = [\n${entryLines.join(",\n")},\n` +
        `];\n` +
        `\n` +
        `// @font-face CSS for the curated fonts. Uses RELATIVE paths\n` +
        `// (e.g. /fonts/inter-latin-400-normal.woff2) so it works wherever the\n` +
        `// document shares the app's origin. For blob: or off-origin contexts\n` +
        `// (the preview-in-new-tab document), call buildFontFaceCss(origin).\n` +
        `export const FONT_FACE_CSS = ${JSON.stringify(fontsCss)};\n` +
        `\n` +
        `// Build the @font-face stylesheet with absolute URLs. Pass an empty\n` +
        `// string (or no argument) to get the relative version above.\n` +
        `export function buildFontFaceCss(origin = "") {\n` +
        `  if (!origin) return FONT_FACE_CSS;\n` +
        `  return FONT_FACE_CSS.replace(/\\/fonts\\//g, origin.replace(/\\/$/, "") + "/fonts/");\n` +
        `}\n` +
        `\n` +
        `export default FONT_CATALOG;\n`
    );
}

async function main() {
    if (!checkOnly) {
        mkdirSync(FONTS_DIR, {recursive: true});
    }

    /** @type {Set<string>} */
    const downloadedFiles = new Set();
    if (existsSync(FONTS_DIR)) {
        for (const f of readdirSync(FONTS_DIR)) {
            if (f.endsWith(".woff2")) downloadedFiles.add(f);
        }
    }

    /** @type {{family:string,subset:string,weight:number,style:string,url:string,file:string,unicodeRange:string|null}[]} */
    const faces = [];
    /** @type {{family:string,category:string,stack:string,weights:number[],system:boolean}[]} */
    const entries = [];
    let downloaded = 0;
    let reused = 0;

    for (const font of FONTS) {
        const resolvedWeights = uniq(font.weights).sort((a, b) => a - b);

        if (font.system === true) {
            entries.push({
                family: font.family,
                category: font.category,
                stack: font.stack,
                weights: resolvedWeights,
                system: true,
            });
            continue;
        }

        if (!font.slug) {
            fail(`font "${font.family}" has no \`slug\` and is not \`system: true\`.`);
        }

        let css;
        try {
            css = await fetchFamilyCss(font.slug, resolvedWeights);
        } catch (e) {
            fail(`could not fetch CSS for "${font.family}" (${font.slug}): ${e.message}`);
        }

        const parsed = parseFaces(css, font.family);
        if (parsed.length === 0) {
            fail(`no usable latin/latin-ext faces returned for "${font.family}".`);
        }

        const actualWeights = new Set();
        for (const face of parsed) {
            const file = localFilename(face);
            actualWeights.add(face.weight);

            if (checkOnly) {
                if (!downloadedFiles.has(file)) {
                    fail(`--check FAILED: missing ${file} (referenced by ${font.family}). Run \`npm run fonts\`.`);
                }
                faces.push({...face, file});
                continue;
            }

            const destPath = join(FONTS_DIR, file);
            const status = await downloadFile(face.url, destPath, false);
            if (status === "ok") {
                downloaded += 1;
                faces.push({...face, file});
            } else if (status === "skip") {
                reused += 1;
                faces.push({...face, file});
            } else {
                console.warn(`scripts/fonts: skipping ${file} (${status})`);
            }
        }

        entries.push({
            family: font.family,
            category: font.category,
            stack: font.stack,
            weights: [...actualWeights].sort((a, b) => a - b),
            system: false,
        });
    }

    const fontsCss = buildFontFaceCss(faces, "");
    const hash = createHash("sha256").update(fontsCss).digest("hex");

    if (checkOnly) {
        const expectedCatalog = buildCatalogModule(entries, fontsCss, hash);
        if (!existsSync(OUT_CATALOG)) {
            fail("resources/js/editor/fonts.config.js is missing. Run `npm run fonts`.");
        }
        if (readFileSync(OUT_CATALOG, "utf8") !== expectedCatalog) {
            fail("resources/js/editor/fonts.config.js is out of date. Run `npm run fonts`.");
        }
        if (!existsSync(OUT_CSS)) {
            fail("public/fonts/fonts.css is missing. Run `npm run fonts`.");
        }
        if (readFileSync(OUT_CSS, "utf8") !== fontsCss) {
            fail("public/fonts/fonts.css is out of date. Run `npm run fonts`.");
        }
        console.log(`scripts/fonts: --check OK (${entries.length} fonts, ${faces.length} faces, sha256 ${hash.slice(0, 12)}).`);
        process.exit(0);
    }

    // Prune orphaned woff2 files we no longer reference.
    const referenced = new Set(faces.map((f) => f.file));
    for (const file of [...downloadedFiles]) {
        if (!referenced.has(file)) {
            rmSync(join(FONTS_DIR, file), {force: true});
            console.log(`scripts/fonts: pruned orphaned ${file}`);
        }
    }

    writeFileSync(OUT_CSS, fontsCss);
    writeFileSync(OUT_CATALOG, buildCatalogModule(entries, fontsCss, hash));

    console.log(
        `scripts/fonts: wrote ${entries.length} fonts (${faces.length} faces) → ` +
            `resources/js/editor/fonts.config.js + public/fonts/fonts.css. ` +
            `Downloaded ${downloaded} new file(s), reused ${reused} existing.`
    );
}

main().catch((e) => fail(e?.message ?? String(e)));
