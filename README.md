# Genea CLI

`genea` is a local-first genealogy archive engine and static web viewer generator written in Go. It operates directly on a Git-friendly directory of individual JSON files representing people, families, and sources, enforcing graph integrity and compiling interactive static tree visualizations without requiring any web server runtime.

---

## Table of Contents

- [Overview](#overview)
- [Installation & Build](#installation--build)
- [Data Directory Layout](#data-directory-layout)
  - [Person Schema (`people/p_<id>.json`)](#person-schema-peoplep_idjson)
  - [Family Schema (`families/f_<id>.json`)](#family-schema-familiesf_idjson)
  - [Source Schema (`sources/s_<id>.json`)](#source-schema-sourcess_idjson)
- [CLI Command & Flag Reference](#cli-command--flag-reference)
- [Functions & Examples](#functions--examples)
  - [1. Display Archive Summary (Default Mode)](#1-display-archive-summary-default-mode)
  - [2. Validate Data Integrity (`-validate`)](#2-validate-data-integrity--validate)
  - [3. Export Static Web Viewer (`-export-web`)](#3-export-static-web-viewer--export-web)
  - [4. Specify Custom Data Directory (`-data`)](#4-specify-custom-data-directory--data)
- [Exit Codes & Error Handling](#exit-codes--error-handling)
- [Typical Workflow](#typical-workflow)

---

## Overview

The Genea CLI provides three primary operations:
1. **Archive Summary & Listing**: Displays entity statistics and lists all individuals and families in the archive.
2. **Graph & Data Integrity Validation**: Verifies strict schema compliance, date validity, and bidirectional graph relationships.
3. **Static Web Site Generation**: Bundles the archive into zero-runtime static web assets (`index.html`, `data.js`, `data.json`, CSS, JS) suitable for deployment or offline browsing via `file://`.

---

## Installation & Build

### Prerequisites
- [Go](https://go.dev/) 1.22 or higher

### Building the Binary

Clone the repository and build the `genea` executable:

```bash
cd genea
go build -o genea .
```

Alternatively, you can run the CLI directly without compiling:

```bash
go run main.go [flags]
```

---

## Data Directory Layout

Genea reads and writes individual JSON files organized in subdirectories under a root data folder (default: `./data`):

```text
data/
├── people/
│   ├── p_john_doe.json
│   └── p_mary_smith.json
├── families/
│   └── f_doe_smith.json
└── sources/
    ├── s_census_1900.json
    └── s_church_st_mary.json
```

### Person Schema (`people/p_<id>.json`)
- **ID format**: Must match regex `^p_[a-zA-Z0-9_-]+$`
- **Input example**:
```json
{
  "id": "p_john_doe",
  "names": [
    {
      "given": "John",
      "surname": "Doe",
      "display": "John Doe"
    }
  ],
  "sex": "male",
  "living": false,
  "events": [
    {
      "id": "e_p1_birth",
      "type": "birth",
      "label": "Birth",
      "date": {
        "qualifier": "exact",
        "year": 1895,
        "month": 3,
        "day": 15
      },
      "place": {
        "name": "Boston, Massachusetts",
        "country": "USA",
        "lat": 42.3601,
        "lng": -71.0589
      },
      "sourceIds": [
        "s_census_1900"
      ]
    }
  ],
  "familyIdsAsSpouse": [
    "f_doe_smith"
  ],
  "familyIdAsChild": null,
  "notes": "Immigrated to New York in 1915."
}
```

### Family Schema (`families/f_<id>.json`)
- **ID format**: Must match regex `^f_[a-zA-Z0-9_-]+$`
- **Constraints**: Maximum of 2 partners.
- **Input example**:
```json
{
  "id": "f_doe_smith",
  "partnerIds": [
    "p_john_doe",
    "p_mary_smith"
  ],
  "children": [
    {
      "personId": "p_robert_doe",
      "relationshipToPartners": "biological"
    }
  ],
  "events": [
    {
      "id": "e_f1_marriage",
      "type": "marriage",
      "label": "Marriage",
      "date": {
        "qualifier": "exact",
        "year": 1920,
        "month": 6,
        "day": 14
      },
      "place": {
        "name": "New York, New York",
        "country": "USA"
      },
      "sourceIds": [
        "s_church_st_mary"
      ]
    }
  ]
}
```

### Source Schema (`sources/s_<id>.json`)
- **ID format**: Must match regex `^s_[a-zA-Z0-9_-]+$`
- **Input example**:
```json
{
  "id": "s_census_1900",
  "title": "1900 United States Federal Census",
  "author": "United States Census Bureau",
  "repository": "National Archives and Records Administration",
  "citation": "Year: 1900; Census Place: Manhattan, New York, New York; Page: 4",
  "url": "https://www.archives.gov/research/census"
}
```

---

## CLI Command & Flag Reference

```
Usage of genea:
  -data string
        Path to data directory (default "./data")
  -validate
        Validate data integrity and exit
  -export-web string
        Export static interactive web viewer to target directory
```

| Flag | Argument Type | Default | Description |
|------|---------------|---------|-------------|
| `-data` | `string` | `"./data"` | Path to the directory containing `people/`, `families/`, and `sources/`. |
| `-validate` | boolean | `false` | Runs graph consistency and entity schema validation, prints result, and exits. |
| `-export-web` | `string` | `""` | Path to target output directory. Validates the archive and generates the static web viewer. |

---

## Functions & Examples

### 1. Display Archive Summary (Default Mode)

When executed without `-validate` or `-export-web`, `genea` performs a baseline integrity check, calculates entity statistics, and prints a summary listing of all individuals and families in the archive.

#### Description
- **Input**: Path to data directory (via `-data`, or defaulting to `./data`).
- **Processing**: Reads all JSON records in `<dataDir>/people`, `<dataDir>/families`, and `<dataDir>/sources`, verifies referential integrity, and formats summary tables.
- **Output**: Writes archive banner, data directory path, integrity status, entity counts, and formatted lists to `stdout`.

#### Example Invocation

```bash
./genea -data ./test_data
```

#### Example Output (`stdout`)

```text
==================================================
  Genea — Local-First Genealogy Archive
==================================================
Data directory: ./test_data

Integrity check: OK (all entities and relations valid)

Archive Statistics:
  • People:   7
  • Families: 2
  • Sources:  4

People in Archive:
  - [p_alice_doe] Alice Doe (female, living)
  - [p_emily_doe] Emily Doe (female, deceased)
  - [p_john_doe] John Doe (male, deceased)
  - [p_mary_smith] Mary Doe (née Smith) (female, deceased)
  - [p_robert_doe] Robert Doe (male, deceased)
  - [p_sarah_johnson] Sarah Doe (née Johnson) (female, deceased)
  - [p_thomas_doe] Thomas Doe Jr. (male, living)

Families in Archive:
  - [f_doe_johnson] Partners: [p_robert_doe p_sarah_johnson], Children: 2
  - [f_doe_smith] Partners: [p_john_doe p_mary_smith], Children: 2
==================================================
```

---

### 2. Validate Data Integrity (`-validate`)

Performs a thorough validation pass across all entities and relational connections in the archive and exits immediately.

#### Description
- **Input**: `-validate` flag, with optional `-data <dir>`.
- **Validation Checks**:
  - **Entity ID Schemas**: Ensures IDs match `p_*`, `f_*`, and `s_*`.
  - **People Integrity**: At least one given name; valid sex (`female`, `male`, `intersex`, `unknown`); valid event dates (months 1–12, days 1–31).
  - **Family Constraints**: Maximum 2 partners per family; all partner IDs exist in `people/`.
  - **Bidirectional Partner Links**: Each partner in a family must include that family ID in their `familyIdsAsSpouse`.
  - **Bidirectional Child Links**: Each child in a family must exist in `people/` and have `familyIdAsChild` pointing back to the family.
  - **Source Citation Integrity**: All `sourceIds` cited in person or family life events must correspond to valid files in `sources/`.
- **Output**: Confirmation message on success (`stdout`), or detailed validation error on failure (`stderr`).

#### Success Example

**Command:**
```bash
./genea -data ./test_data -validate
```

**Output (`stdout`):**
```text
All records and graph relations are valid.
```

**Exit Code:** `0`

#### Failure Example (Broken Relationship or Invalid Data)

If an entity references a missing person, invalid source ID, or has a mismatched spouse link:

**Command:**
```bash
./genea -data ./corrupted_data -validate
```

**Output (`stderr`):**
```text
Validation failed: family f_doe_smith references non-existent partner p_unknown_person
```

**Exit Code:** `1`

---

### 3. Export Static Web Viewer (`-export-web`)

Compiles the entire archive into a self-contained, interactive static web application that can be hosted on GitHub Pages, Cloudflare Pages, S3, or viewed locally in any browser via `file://`.

#### Description
- **Input**: `-export-web <output_directory>` flag specifying destination directory, plus optional `-data <dir>`.
- **Processing**:
  1. Executes `FSStore.ValidateAll()`; halts immediately if validation fails.
  2. Creates the target directory.
  3. Extracts embedded static web assets (HTML shell, CSS stylesheets, layout engines, and UI scripts).
  4. Bundles all people, families, and sources into `data.json` and `data.js` (defining `window.GENEA_DATA` for CORS-free local file viewing).
- **Output**: Directory populated with static web assets and an export confirmation message on `stdout`.

#### Example Invocation

```bash
./genea -data ./test_data -export-web ./dist
```

#### Example Output (`stdout`)

```text
Successfully generated static web application in: ./dist
Exported: 7 people, 2 families, 4 sources
```

#### Generated Output Directory Structure

```text
dist/
├── index.html        # Interactive single-page application shell
├── data.json         # Raw JSON data export
├── data.js           # window.GENEA_DATA bundle for local file:// execution
├── css/
│   ├── controls.css  # Viewport toolbar, pan/zoom, minimap styles
│   ├── main.css      # Core application typography and color tokens
│   ├── modal.css     # Accessible <dialog> detail inspector styles
│   └── tree.css      # SVG node cards, connectors, and lineage styles
├── js/
│   ├── app.js        # Main initialization entrypoint
│   ├── graph-store.js# O(1) in-memory lineage lookups
│   ├── state.js      # URL hash routing and state management
│   ├── components/   # Person detail modal and SVG node card renderers
│   ├── layout/       # Hourglass and generational tier tree layout algorithms
│   ├── utils/        # Date formatting and DOM helpers
│   └── viewport/     # Pan, zoom, inertia, and minimap controllers
└── data/
    ├── data.json     # Mirrored data bundle
    └── data.js       # Mirrored data bundle
```

#### Viewing the Exported Web Application

You can view the exported web app in any browser:

- **Local file access** (no server required):
  ```bash
  open ./dist/index.html
  # or on Linux:
  xdg-open ./dist/index.html
  ```
- **Local HTTP server** (optional):
  ```bash
  python3 -m http.server -d ./dist 8080
  ```

---

### 4. Specify Custom Data Directory (`-data`)

The `-data` flag can be combined with any operation to target a specific data directory rather than the default `./data`.

#### Description
- **Input**: `-data <directory_path>`
- **Output**: Operates on the specified directory.

#### Examples

**Run summary on custom archive:**
```bash
./genea -data /path/to/my_family_archive
```

**Validate a staging archive:**
```bash
./genea -data ./staging_data -validate
```

**Export web viewer from custom location:**
```bash
./genea -data /path/to/my_family_archive -export-web /var/www/genealogy
```

---

## Exit Codes & Error Handling

| Exit Code | Cause | Output Stream | Example Message |
|:---------:|-------|:-------------:|-----------------|
| `0` | Command completed successfully | `stdout` | `All records and graph relations are valid.` |
| `1` | Failed to initialize store / data directory missing | `stderr` | `Error: failed to initialize store at ./invalid: ...` |
| `1` | Integrity validation failed | `stderr` | `Validation failed: person p_1: invalid month 13` |
| `1` | Validation failed prior to export | `stderr` | `Validation failed prior to export: ...` |
| `1` | Failed to write web assets to output directory | `stderr` | `Error generating static site: failed to create output directory ...` |

---

## Typical Workflow

When maintaining a genealogy archive with Genea and Git:

1. **Add or Edit Records**:
   Create or edit JSON records in `data/people/`, `data/families/`, or `data/sources/`.

2. **Verify Integrity**:
   ```bash
   ./genea -validate
   ```
   Fix any reported relationship mismatches or missing sources.

3. **Inspect Archive Statistics**:
   ```bash
   ./genea
   ```

4. **Export and Preview**:
   ```bash
   ./genea -export-web ./dist
   xdg-open ./dist/index.html
   ```

5. **Commit to Version Control**:
   ```bash
   git add data/
   git commit -m "Add biographical events and citations for Doe family"
   ```
