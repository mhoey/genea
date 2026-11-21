# Genealogy Archive & Static Viewer — System Specification

## 1. Overview & Design Goals
A local-first genealogy system backed by a private Git repository of structured JSON records, paired with a Go core engine for validation, mutations, and static site generation.

* **Longevity over framework churn:** Favor Go standard library tooling, plain JSON data files, and static HTML/CSS/JS output with minimal client-side interaction so the archive remains readable and buildable over decades.
* **Two operational modes:**
  * **Local Studio (`localhost`):** Supports reading, adding/updating records and relations, validating graph integrity, committing to Git, and building the static site.
  * **Hosted Static Viewer (Future):** Purely read-only static files (HTML, CSS, JS, JSON bundle) deployable to any static host with zero runtime backend or write auth.

---

## 2. Repository & Data Layout
Records are stored as one JSON file per entity to keep Git diffs focused and minimize merge conflicts:

```text
data/
├── people/     # p_<id>.json
├── families/   # f_<id>.json
└── sources/    # s_<id>.json
