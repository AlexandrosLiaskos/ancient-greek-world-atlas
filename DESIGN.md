# Ancient Greek World Atlas Design System

## Direction

**The Cartographic Workbench** is the approved north-star direction. The interface behaves like a carefully edited gazetteer laid beside a working map: a compact typographic masthead, a fixed tabbed register, a dominant geographic canvas, and small evidence-rich overlays. It borrows Lagoons' clarity and completeness without reproducing its visual surface mechanically.

Approved references:

- `docs/design/references/webgis-palette-approved.png`
- `docs/design/references/webgis-direction-a-approved.png`

The mock is a composition contract, not a data source. Its invented labels, counts, map texture, and boundary suggestions must never enter production. Runtime content and counts come only from the reviewed 226-entity release.

## Theme

The physical scene is a researcher or curious visitor using a bright screen at a desk or on location, moving repeatedly between an index and a map. The theme is therefore light, exact, low-glare, and information-dense. Historical depth comes from typography, evidence, and geography—not parchment, marble, gold, ruins, or faux-antique texture.

Color strategy is **Restrained**. Neutrals carry the product; deep green marks primary navigation and selection; blue, oxide, and violet encode entity classes. Coloured surfaces remain rare.

## Color

All production tokens use OKLCH. Hex values below document the approved palette reference only.

| Role | Token | OKLCH | Reference hex | Use |
|---|---|---|---|---|
| Canvas | `--color-canvas` | `oklch(97.53% 0.004 106.47)` | `#f7f7f4` | Page and panel ground |
| Surface | `--color-surface` | `oklch(100% 0 0)` | `#ffffff` | Dialogs, previews, elevated controls |
| Carbon | `--color-ink` | `oklch(21.01% 0.0066 134.98)` | `#171916` | Primary text and strong rules |
| Muted ink | `--color-muted` | `oklch(43% 0.012 150)` | — | Secondary text with AA contrast |
| Rule | `--color-rule` | `oklch(83.80% 0.0088 128.58)` | `#c8cbc5` | Hairlines and inactive boundaries |
| Atlas green | `--color-accent` | `oklch(42.57% 0.0791 164.27)` | `#185c43` | Selection, primary actions, focus |
| Settlement | `--color-settlement` | `oklch(49.15% 0.0892 239.53)` | `#28678e` | Settlement circles and corresponding labels |
| Sanctuary | `--color-sanctuary` | `oklch(51.34% 0.1087 41.28)` | `#9a4f32` | Sanctuary diamonds and corresponding labels |
| Polity | `--color-polity` | `oklch(48.74% 0.0882 298.13)` | `#66548b` | Polity squares and corresponding labels |
| Error | `--color-error` | `oklch(48% 0.14 26)` | — | Actionable failures only |

Colour never acts alone. Every class has a shape and text label; selection has outline, fill, and state text; confidence and spatial role have labels or patterns.

## Typography

Use three tightly scoped roles:

1. **Display:** locally hosted GFS Solomos for the Greek masthead only. It carries cultural specificity without entering controls or data.
2. **Editorial:** Georgia, `Times New Roman`, serif for entity names and long-form record headings.
3. **Interface:** system-ui, `Segoe UI`, Arial, sans-serif for navigation, controls, descriptions, and metadata. It loads immediately and keeps Greek legible.

No uppercase tracked eyebrow appears above the masthead or panel headings. The title is the sole expressive typographic moment. UI and record type use a fixed product scale:

| Token | Size | Line height | Role |
|---|---:|---:|---|
| `--text-caption` | `0.75rem` | `1.35` | Coordinates and compact metadata |
| `--text-secondary` | `0.875rem` | `1.4` | Supporting labels and dates |
| `--text-body` | `1rem` | `1.55` | Descriptions and controls |
| `--text-subheading` | `1.25rem` | `1.3` | Entity names in catalogue |
| `--text-heading` | `1.75rem` | `1.15` | Dialog section headings |

The masthead title is a controlled exception: `2.75rem` on desktop, `1.75rem` on mobile, never fluid beyond those breakpoint values. Long prose is capped at `70ch`. Numeric data uses tabular numerals.

## Spacing and geometry

The spacing scale is 4, 8, 12, 16, 24, 32, 48, and 64 CSS pixels, exposed as semantic `rem` tokens from `--space-2xs` through `--space-3xl`. Related metadata sits at 4–8px; row internals at 8–12px; panel sections at 16–24px; only major dialog sections use 32–48px.

Product geometry is square and ruled:

- standard borders are 1px hairlines;
- buttons, panels, list rows, previews, and dialogs have zero radius;
- circles remain reserved for settlement markers, clusters, and icon geometry;
- shadows appear only where an overlay must separate from the map;
- no side-stripe accents, nested cards, glass surfaces, or ornamental dividers.

## Layout

### Desktop

- Masthead: 5rem high, title optically centred between hairlines.
- Workbench: fixed 25rem width with four equal horizontal tabs.
- Map: fills all remaining width and height.
- Workbench header and tabs remain fixed; only panel content scrolls.
- Legend stays inside the map at lower right; map status occupies a slim lower strip.
- Preview is anchored to its marker and clamped within the map viewport.

### Mobile

- Map remains the background canvas.
- A persistent four-action bottom bar opens the corresponding workbench tab.
- Workbench becomes a 74–82dvh bottom sheet with sticky header, close control, safe-area padding, and independent scrolling.
- Opening the sheet never hides the map completely; opening full record details uses a separate full-screen dialog.
- Touch targets are at least 44×44 CSS pixels.

The mobile layout is a structural adaptation, not a scaled desktop sidebar.

## Components

### Masthead

Contains only title, language switch, and About action. No subtitle, dataset count, breadcrumb, or duplicate atlas label.

### Tool tabs

Catalogue, Filters, Search, and Statistics share one visual and keyboard pattern. Active state uses a green underline, stronger ink, and `aria-selected`; hover never substitutes for focus.

### Catalogue rows

Rows form a continuous register divided by hairlines, not cards. Each shows an unnumbered class symbol, active-language name, locality/country, chronology, and uncertainty cue where needed. Selected state uses a full subtle green wash plus an outline, not a thick side stripe.

### Facets

One facet is explored at a time. Searchable option rows show label, contextual count, checkbox state, and disabled zero-count state. Active filters become removable chips with full-perimeter hairlines. Chronology uses paired accessible range inputs plus editable signed-year values and localized era labels.

### Statistics

Compact horizontal distributions behave as filter buttons. Exact counts remain visible as text; bar length is supplementary. They use class colours only for the corresponding categories and green for selection.

### Markers and clusters

- settlement: unnumbered blue circle;
- sanctuary: unnumbered oxide diamond;
- polity: unnumbered violet square;
- cluster: outlined neutral/green circle containing only its record count.

Proxy and representative-centre points gain a secondary ring or dashed treatment plus accessible explanatory text. No political or regional polygon is drawn.

### Preview and details

Map preview is compact and task-oriented: identity, class, place, chronology, uncertainty, and “View record”. The full record uses a native modal dialog on desktop and full-screen sheet on mobile, with a horizontally scrollable two-image gallery followed by clear sections for description, chronology, geography, relationships, sources, identifiers, and editorial status. Every image exposes its bilingual caption, creator, licence and source without obscuring the image.

## Motion

Motion communicates state only. Standard transitions last 180ms with an ease-out curve. The bottom sheet and dialogs may use a 220ms transform/opacity transition; list rows and tab states use 120–180ms colour changes. Map pan/zoom follows Leaflet conventions. `prefers-reduced-motion: reduce` removes smooth scrolling, map flight, and nonessential transitions.

## Content and language

Greek is the first-visit language. Interface copy uses consistent terms: Κατάλογος, Φίλτρα, Αναζήτηση, Στατιστικά, Εγγραφή, Υπόμνημα. English mirrors every state. Controls use active verb+noun labels such as “Προβολή εγγραφής”, “Καθαρισμός φίλτρων”, and “Αντιγραφή συντεταγμένων”. Errors state what failed and the next usable action.

Dates never expose signed storage years. Location uncertainty is described explicitly rather than hidden in an icon tooltip.

## Accessibility and verification

- WCAG 2.2 AA text and component contrast is mandatory.
- Every control has default, hover where applicable, focus-visible, active, disabled, loading, error, and success behaviour.
- Native semantics and `<dialog>` precede custom ARIA.
- Tabs use roving tabindex; result changes use a restrained live region.
- Text remains usable at 200% zoom and 320px width without horizontal page scrolling.
- Keyboard, coarse pointer, fine pointer, reduced motion, long Greek strings, empty results, failed data, and failed map enhancement are release test cases.
