package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/mhoey/genea/internal/site"
	"github.com/mhoey/genea/internal/store"
)

func main() {
	dataDir := flag.String("data", "./data", "Path to data directory")
	validateOnly := flag.Bool("validate", false, "Validate data integrity and exit")
	exportWeb := flag.String("export-web", "", "Export static interactive web viewer to target directory")

	flag.Parse()

	fsStore, err := store.NewFSStore(*dataDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to initialize store at %s: %v\n", *dataDir, err)
		os.Exit(1)
	}

	if *validateOnly {
		if err := fsStore.ValidateAll(); err != nil {
			fmt.Fprintf(os.Stderr, "Validation failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("All records and graph relations are valid.")
		return
	}

	if *exportWeb != "" {
		if err := fsStore.ValidateAll(); err != nil {
			fmt.Fprintf(os.Stderr, "Validation failed prior to export: %v\n", err)
			os.Exit(1)
		}

		if err := site.GenerateSite(fsStore, *exportWeb); err != nil {
			fmt.Fprintf(os.Stderr, "Error generating static site: %v\n", err)
			os.Exit(1)
		}

		people, _ := fsStore.ListPeople()
		families, _ := fsStore.ListFamilies()
		sources, _ := fsStore.ListSources()

		fmt.Printf("Successfully generated static web application in: %s\n", *exportWeb)
		fmt.Printf("Exported: %d people, %d families, %d sources\n", len(people), len(families), len(sources))
		return
	}

	printSummary(fsStore, *dataDir)
}

func printSummary(s *store.FSStore, dataDir string) {
	fmt.Println("==================================================")
	fmt.Println("  Genea — Local-First Genealogy Archive")
	fmt.Println("==================================================")
	fmt.Printf("Data directory: %s\n\n", dataDir)

	if err := s.ValidateAll(); err != nil {
		fmt.Printf("Integrity check: FAILED (%v)\n\n", err)
	} else {
		fmt.Println("Integrity check: OK (all entities and relations valid)")
	}

	people, err := s.ListPeople()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error listing people: %v\n", err)
		return
	}

	families, err := s.ListFamilies()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error listing families: %v\n", err)
		return
	}

	sources, err := s.ListSources()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error listing sources: %v\n", err)
		return
	}

	fmt.Printf("\nArchive Statistics:\n")
	fmt.Printf("  • People:   %d\n", len(people))
	fmt.Printf("  • Families: %d\n", len(families))
	fmt.Printf("  • Sources:  %d\n", len(sources))

	fmt.Printf("\nPeople in Archive:\n")
	for _, p := range people {
		displayName := p.ID
		if len(p.Names) > 0 {
			if p.Names[0].Display != "" {
				displayName = p.Names[0].Display
			} else {
				displayName = fmt.Sprintf("%s %s", p.Names[0].Given, p.Names[0].Surname)
			}
		}
		status := "deceased"
		if p.Living {
			status = "living"
		}
		fmt.Printf("  - [%s] %s (%s, %s)\n", p.ID, displayName, p.Sex, status)
	}

	fmt.Printf("\nFamilies in Archive:\n")
	for _, f := range families {
		fmt.Printf("  - [%s] Partners: %v, Children: %d\n", f.ID, f.PartnerIDs, len(f.Children))
	}

	fmt.Println("==================================================")
}
