# Genea - Local-First Genealogy Archive

Genea is a local-first genealogy application that stores your family history data in plain JSON files, with no external dependencies or cloud storage.

## Features

- **Local-First**: All data is stored locally as JSON files
- **No External Dependencies**: No cloud services, databases, or external APIs required
- **Simple CLI Interface**: Easy to use command-line interface for managing genealogy data
- **Static Site Generation**: Export interactive web viewers of your genealogy data

## Installation

Download the appropriate binary from the [releases page](https://github.com/mhoey/genea/releases), or build from source:

```bash
go build -o genea .
```

## Usage

The application provides several commands through command-line flags:

### Basic Commands

- `./genea` - List available command-line options
- `./genea -summary` - Show summary of all people, families, and sources in the archive
- `./genea -validate` - Validate data integrity and exit
- `./genea -export-web <directory>` - Export static interactive web viewer to target directory
- `./genea -updateperson` - Update a person record interactively

### Update Person Command

The new `-updateperson` command provides an interactive interface for updating person records:

```bash
./genea -updateperson
```

This command:
1. Prompts you to enter part of a name to search for people
2. Shows up to 10 matching people with their IDs and names
3. Lets you select a person to update
4. Displays available attributes that can be updated
5. Lets you choose an attribute and enter the new value
6. Handles special cases like dates with qualifiers
7. Confirms changes before applying them

## Data Structure

All data is stored in JSON format in the `data/` directory by default:

- `people/*.json` - Person records with names, genders, life events, etc.
- `families/*.json` - Family relationships between people
- `sources/*.json` - Source references for genealogical information

## Example Workflow

1. Start with basic data in the `data/` directory
2. Run `./genea -summary` to see your current data
3. Use `./genea -updateperson` to update person records interactively
4. Export to web with `./genea -export-web ./web-output`
5. View the generated website in a browser

## Contributing

Contributions are welcome! Please submit issues and pull requests on the [GitHub repository](https://github.com/mhoey/genea).

## License

MIT