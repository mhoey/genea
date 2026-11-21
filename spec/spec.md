# Genealogy Archive & Static Viewer — System Specification

## 1. Overview & Design Goals
A local-first genealogy system backed by a private Git repository of structured JSON records, paired with a Go core engine for validation, mutations, and static site generation.

* **Longevity over framework churn:** Favor Go standard library tooling, plain JSON data files, and static HTML/CSS/JS output with minimal client-side interaction so the archive remains readable and buildable over decades.
* **No web server:** The application does not expose a web server. Since genealogy data is non-volatile, future versions will use static site generation to produce a static site.
* **Operational modes:**
  * **Core CLI:** Supports reading archive data, adding/updating records and relations, and validating graph integrity directly against data files.
  * **Static Site Generation (Future):** Purely read-only static files (HTML, CSS, JS, JSON bundle) deployable to any static host with zero runtime backend or server processes.

---

## 2. Repository & Data Layout
Records are stored as one JSON file per entity to keep Git diffs focused and minimize merge conflicts:

```text
data/
├── people/     # p_<id>.json
├── families/   # f_<id>.json
└── sources/    # s_<id>.json
```
