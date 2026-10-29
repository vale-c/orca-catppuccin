// Generates the Catppuccin app and terminal themes from the vendored palette.
// Usage: node scripts/build.mjs           write plugins/catppuccin/{themes,terminal}/*.json
//        node scripts/build.mjs --check   exit 1 if a committed file differs from the output
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')
const PLUGIN_DIR = path.join(ROOT, 'plugins', 'catppuccin')
const PALETTE = JSON.parse(readFileSync(path.join(ROOT, 'scripts', 'catppuccin-palette.json'), 'utf8'))
const FLAVORS = ['latte', 'frappe', 'macchiato', 'mocha']

const APP_TOKENS = {
  '--background': 'base',
  '--editor-surface': 'base',
  '--foreground': 'text',
  '--card': 'mantle',
  '--card-foreground': 'text',
  '--popover': 'mantle',
  '--popover-foreground': 'text',
  '--primary': 'mauve',
  '--primary-foreground': 'base',
  '--secondary': 'surface0',
  '--secondary-foreground': 'text',
  '--muted': 'mantle',
  '--muted-foreground': 'subtext0',
  '--accent': 'surface0',
  '--accent-foreground': 'text',
  '--border': 'surface1',
  '--input': 'surface1',
  '--ring': 'mauve',
  '--chart-1': 'mauve',
  '--chart-2': 'blue',
  '--chart-3': 'green',
  '--chart-4': 'peach',
  '--chart-5': 'red',
  '--sidebar': 'mantle',
  '--sidebar-foreground': 'text',
  '--sidebar-primary': 'mauve',
  '--sidebar-primary-foreground': 'base',
  '--sidebar-accent': 'surface0',
  '--sidebar-accent-foreground': 'text',
  '--sidebar-border': 'surface0',
  '--sidebar-ring': 'mauve'
}

const SYNTAX = [
  { name: 'Comments', role: 'overlay2', fontStyle: 'italic', scope: ['comment', 'punctuation.definition.comment'] },
  { name: 'Variables', role: 'text', scope: ['variable', 'support.variable'] },
  { name: 'Parameters', role: 'maroon', scope: ['variable.parameter'] },
  { name: 'Builtins', role: 'red', scope: ['variable.language', 'support.function.builtin'] },
  { name: 'Constants', role: 'peach', scope: ['constant', 'support.constant', 'variable.other.constant'] },
  { name: 'Numbers', role: 'peach', scope: ['constant.numeric'] },
  { name: 'Symbols', role: 'red', scope: ['constant.other.symbol'] },
  { name: 'Enum members', role: 'teal', scope: ['variable.other.enummember'] },
  { name: 'Keywords', role: 'mauve', scope: ['keyword', 'storage.type', 'storage.modifier'] },
  { name: 'Operators', role: 'sky', scope: ['keyword.operator'] },
  { name: 'Strings', role: 'green', scope: ['string', 'punctuation.definition.string', 'markup.inline.raw', 'markup.raw'] },
  { name: 'Escapes and regular expressions', role: 'pink', scope: ['constant.character.escape', 'string.regexp'] },
  { name: 'Functions', role: 'blue', scope: ['entity.name.function', 'support.function'] },
  { name: 'Macros', role: 'rosewater', scope: ['entity.name.function.macro', 'meta.preprocessor'] },
  {
    name: 'Types',
    role: 'yellow',
    scope: [
      'entity.name.type',
      'entity.name.class',
      'entity.name.namespace',
      'entity.other.inherited-class',
      'support.type',
      'support.class',
      'storage.type.annotation'
    ]
  },
  { name: 'Punctuation', role: 'overlay2', scope: ['punctuation', 'meta.brace'] },
  { name: 'Tags', role: 'blue', scope: ['entity.name.tag'] },
  { name: 'Attributes', role: 'yellow', scope: ['entity.other.attribute-name'] },
  { name: 'Property keys', role: 'blue', scope: ['support.type.property-name'] },
  { name: 'Decorators', role: 'yellow', scope: ['meta.decorator', 'entity.name.function.decorator'] },
  { name: 'Headings', role: 'red', fontStyle: 'bold', scope: ['markup.heading', 'entity.name.section'] },
  { name: 'Bold', fontStyle: 'bold', scope: ['markup.bold'] },
  { name: 'Italic', fontStyle: 'italic', scope: ['markup.italic'] },
  { name: 'Links', role: 'blue', fontStyle: 'underline', scope: ['markup.underline.link', 'string.other.link'] },
  { name: 'Quotes', role: 'overlay2', fontStyle: 'italic', scope: ['markup.quote'] },
  { name: 'Inserted', role: 'green', scope: ['markup.inserted'] },
  { name: 'Deleted', role: 'red', scope: ['markup.deleted'] },
  { name: 'Changed', role: 'blue', scope: ['markup.changed'] },
  { name: 'Invalid', role: 'red', scope: ['invalid'] }
]

const TERMINAL = {
  background: 'base',
  foreground: 'text',
  cursor: 'rosewater',
  cursorAccent: 'crust',
  selectionForeground: 'text'
}
const ANSI = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']
const brightKey = (name) => `bright${name[0].toUpperCase()}${name.slice(1)}`

const OVERRIDES = {
  // Why: Latte subtext0 on base is 4.37:1, under Orca's 4.5:1 floor, which would drop the pair.
  latte: { '--muted-foreground': 'subtext1', cursorAccent: 'base' }
}

// Mirrors CONTRAST_PAIRS and RINGS in Orca's renderer/src/lib/plugin-theme-tokens.ts.
const CONTRAST_PAIRS = [
  ['--background', '--foreground'],
  ['--background', '--muted-foreground'],
  ['--card', '--card-foreground'],
  ['--popover', '--popover-foreground'],
  ['--primary', '--primary-foreground'],
  ['--secondary', '--secondary-foreground'],
  ['--muted', '--muted-foreground'],
  ['--accent', '--accent-foreground'],
  ['--sidebar', '--sidebar-foreground'],
  ['--sidebar-primary', '--sidebar-primary-foreground'],
  ['--sidebar-accent', '--sidebar-accent-foreground']
]
const RINGS = [
  ['--ring', '--background'],
  ['--sidebar-ring', '--sidebar']
]
const MIN_TEXT_CONTRAST = 4.5
const MIN_RING_CONTRAST = 2
const MIN_SYNTAX_CONTRAST = 3
// Why above Orca's 3:1: margin so rounding in another color pipeline cannot tip a shade under.
const SYNTAX_TARGET = 3.05
const SELECTION_ALPHA = 0.25

const parseHex = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16))
const toHex = (rgb) =>
  `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`

function luminance(hex) {
  const [r, g, b] = parseHex(hex).map((value) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const fromLinear = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

function hexToOklab(hex) {
  const [r, g, b] = parseHex(hex).map((c) => toLinear(c / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ]
}

function oklabToHex([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return toHex(
    [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ].map((c) => fromLinear(Math.min(1, Math.max(0, c))) * 255)
  )
}

/** Steps OKLCH lightness away from the background (a, b unchanged keeps chroma and hue). */
function readableOn(hex, background, dark) {
  const [L, a, b] = hexToOklab(hex)
  const step = dark ? 0.001 : -0.001
  let shipped = hex
  for (let next = L; contrast(shipped, background) < SYNTAX_TARGET; next += step) {
    if (next < 0 || next > 1) {
      throw new Error(`cannot reach ${SYNTAX_TARGET}:1 for ${hex} on ${background}`)
    }
    shipped = oklabToHex([next, a, b])
  }
  return shipped
}

function buildFlavor(flavor, adjustments) {
  const { dark, colors, ansiColors } = PALETTE[flavor]
  const role = (key, fallback) => {
    const name = OVERRIDES[flavor]?.[key] ?? fallback
    if (!colors[name]) {
      throw new Error(`${flavor}: unknown palette role "${name}" for ${key}`)
    }
    return colors[name].hex
  }
  const base = colors.base.hex

  const tokens = Object.fromEntries(Object.entries(APP_TOKENS).map(([token, name]) => [token, role(token, name)]))
  for (const [surface, text] of CONTRAST_PAIRS) {
    const ratio = contrast(tokens[surface], tokens[text])
    if (ratio < MIN_TEXT_CONTRAST) {
      throw new Error(`${flavor}: ${surface}/${text} is ${ratio.toFixed(2)}:1, under ${MIN_TEXT_CONTRAST}:1`)
    }
  }
  for (const [ring, surface] of RINGS) {
    const ratio = contrast(tokens[ring], tokens[surface])
    if (ratio < MIN_RING_CONTRAST) {
      throw new Error(`${flavor}: ${ring}/${surface} is ${ratio.toFixed(2)}:1, under ${MIN_RING_CONTRAST}:1`)
    }
  }

  const syntaxColor = new Map()
  const syntaxHex = (name) => {
    if (!syntaxColor.has(name)) {
      const upstream = role(name, name)
      const shipped = readableOn(upstream, base, dark)
      if (shipped !== upstream) {
        adjustments.push({ flavor, role: name, upstream, shipped, ratio: contrast(shipped, base) })
      }
      syntaxColor.set(name, shipped)
    }
    return syntaxColor.get(name)
  }
  const tokenColors = SYNTAX.map(({ name, role: colorRole, fontStyle, scope }) => ({
    name,
    scope,
    settings: {
      ...(colorRole ? { foreground: syntaxHex(colorRole) } : {}),
      ...(fontStyle ? { fontStyle } : {})
    }
  }))

  const terminalRoles = Object.fromEntries(Object.entries(TERMINAL).map(([key, name]) => [key, role(key, name)]))
  const overlay = parseHex(role('selection', 'overlay2'))
  const selectionBackground = toHex(
    parseHex(base).map((c, index) => overlay[index] * SELECTION_ALPHA + c * (1 - SELECTION_ALPHA))
  )
  const { background, foreground, cursor, cursorAccent, selectionForeground } = terminalRoles
  const terminal = {
    schemaVersion: 1,
    mode: dark ? 'dark' : 'light',
    terminal: {
      background,
      foreground,
      cursor,
      cursorAccent,
      selectionBackground,
      selectionForeground,
      ...Object.fromEntries(ANSI.map((name) => [name, ansiColors[name].normal.hex])),
      ...Object.fromEntries(ANSI.map((name) => [brightKey(name), ansiColors[name].bright.hex]))
    }
  }

  return {
    [`themes/catppuccin-${flavor}.json`]: { base: dark ? 'dark' : 'light', tokens, tokenColors },
    [`terminal/catppuccin-${flavor}.json`]: terminal
  }
}

function assertUniqueScopes() {
  const seen = new Set()
  for (const scope of SYNTAX.flatMap((rule) => rule.scope)) {
    if (seen.has(scope)) {
      throw new Error(`scope "${scope}" is listed twice; the later rule would silently win`)
    }
    seen.add(scope)
  }
}

assertUniqueScopes()
const adjustments = []
const files = Object.assign({}, ...FLAVORS.map((flavor) => buildFlavor(flavor, adjustments)))

console.log('Syntax colors adjusted to reach 3:1 on base:')
console.log('flavor     role       upstream  shipped   ratio')
for (const { flavor, role, upstream, shipped, ratio } of adjustments) {
  console.log(`${flavor.padEnd(10)} ${role.padEnd(10)} ${upstream}   ${shipped}   ${ratio.toFixed(2)}`)
}
if (adjustments.some(({ ratio }) => ratio < MIN_SYNTAX_CONTRAST)) {
  throw new Error('an adjusted syntax color is still under 3:1')
}

const check = process.argv.includes('--check')
const stale = []
for (const [relative, data] of Object.entries(files)) {
  const file = path.join(PLUGIN_DIR, relative)
  const text = `${JSON.stringify(data, null, 2)}\n`
  if (check) {
    if (!existsSync(file) || readFileSync(file, 'utf8') !== text) {
      stale.push(relative)
    }
  } else {
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
}
if (stale.length) {
  console.error(`Out of date (run node scripts/build.mjs): ${stale.join(', ')}`)
  process.exit(1)
}
console.log(check ? `All ${Object.keys(files).length} generated files are up to date.` : `Wrote ${Object.keys(files).length} files.`)
