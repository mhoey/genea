# Genealogy Archive & Static Viewer — System Specification

## 1. Overview & Design Goals
A local-first genealogy system backed by a private Git repository of structured JSON records, paired with a Go core engine for validation, mutations, and static site generation.

* **Longevity over framework churn:** Favor Go standard library tooling, plain JSON data files, and static HTML/CSS/JS output with minimal client-side interaction so the archive remains readable and buildable over decades.
* **No web server:** The application does not require a web server runtime. The static site generator produces purely static HTML, CSS, JavaScript, and JSON assets deployable to any static host (GitHub Pages, Cloudflare Pages, S3) or viewable locally via `file://`.
* **Operational modes:**
  * **Core CLI:** Supports reading archive data, displaying summary statistics, adding/updating records and relations, and validating graph integrity directly against data files (`-validate`).
  * **Static Site Generation:** Compiles and exports the archive into a standalone interactive web application (`-export-web <dir>`).

---

## 2. Repository & Data Layout
Records are stored as one JSON file per entity to keep Git diffs focused and minimize merge conflicts:

```text
genea/
├── data/
│   ├── people/     # p_<id>.json
│   ├── families/   # f_<id>.json
│   └── sources/    # s_<id>.json
├── internal/
│   ├── store/      # Archive storage, models, integrity validation
│   └── site/       # Static site generator and bundle packager
│       ├── generator.go
│       ├── bundle.go
│       └── templates/ # Embedded static web templates
├── web/            # Source web templates for distribution
│   ├── index.html
│   ├── css/        # main.css, tree.css, controls.css, modal.css
│   └── js/         # app.js, state.js, graph-store.js, layout/, viewport/, components/, utils/
├── spec/
│   ├── spec.md     # System specification
│   └── archive/    # Archived implementation plans
└── main.go         # Application CLI entrypoint
```

---

## 3. CLI Interface

The core executable provides flags for archive operations:

```bash
# Display archive statistics and summaries
genea -data ./data

# Validate graph integrity and relation consistency
genea -data ./data -validate

# Export standalone interactive static web application to target directory
genea -data ./data -export-web ./dist
```

### Validation Pre-requisite
Prior to generating the static site, the generator executes `FSStore.ValidateAll()` ensuring:
- All partner and child links reference existing person records.
- Bi-directional spouse relations match between people and family entities.
- Life event source IDs refer to valid source records.
- Graph acyclicity and structural integrity.

---

## 4. Static Site Architecture

The static site generator compiles the archive into zero-runtime static web assets:

### 4.1 Data Bundle (`data.json` & `data.js`)
- `data.json`: Consolidated JSON containing all people, families, and sources.
- `data.js`: Defines `window.GENEA_DATA = { ... }` allowing direct local browsing under `file://` protocols without browser CORS restrictions.

### 4.2 Web Application Structure
* **HTML5 Shell (`index.html`):** Semantic application shell featuring header with real-time "Focus on Person" search, view mode toggle, SVG viewport container, minimap, floating toolbar, synchronized scrollbars, and accessible HTML5 `<dialog>` for detail inspection.
* **Graph Store (`js/graph-store.js`):** In-memory graph index supporting $O(1)$ relational lookups (`getParents`, `getSpouses`, `getChildren`, `getSource`) and text searching.
* **Layout Engine (`js/layout/`):**
  * **Hourglass Lineage View:** Centered on active root person; ancestors expand upward, descendants downward, spouses placed horizontally.
  * **All Families / Generational Tier View:** Computes generational depth ranks, arranges family units and spouse pods, routes orthogonal step-connectors and cubic Bézier splines.
  * **Node Geometry:** Standardized $220\text{px} \times 84\text{px}$ cards with $140\text{px}$ generational tier gaps and $32\text{px}$ horizontal node spacing.
* **Interactive Viewport (`js/viewport/`):**
  * Dynamic SVG `viewBox` pan and zoom ($0.1\times$ to $3.0\times$).
  * Smooth pointer drag panning with inertia, cursor-centered mouse wheel zooming, and touch pinch-to-zoom.
  * Directional pan buttons, zoom in/out/reset controls, fit-to-screen (`⛶`), and center on selected person (`⌖`).
  * Minimap radar view showing overall graph density and visible viewport boundary with click-and-drag navigation.
  * Virtual horizontal and vertical scrollbars synchronized with SVG viewBox coordinates.
* **Person Modal Dialog (`js/components/person-modal.js`):**
  * Displays complete demographics and names (given name, surname, birth surname, display name).
  * Life events timeline (birth, baptism, marriage, death, residence) with exact/about/before/after qualifiers, places, descriptions, and source citations.
  * Family relationship cards for parents, spouses, and children with inter-modal navigation.
  * General biographical notes and source references with external links.
* **State & Real-Time Search (`js/state.js`):**
  * URL hash synchronization (`#person=p_id&view=hourglass`) supporting browser history back/forward.
  * "Focus on Person" input with autocomplete dropdown; when search yields a unique match in the tree, the viewport automatically pans and centers on the matching person.
