package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/mhoey/genea/internal/store"
)

func main() {
	dataDir := flag.String("data", "./data", "Path to data directory")
	addr := flag.String("addr", ":8080", "Server listen address")
	serve := flag.Bool("serve", false, "Start Local Studio web server")
	validateOnly := flag.Bool("validate", false, "Validate data integrity and exit")

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

	if *serve {
		startServer(fsStore, *addr)
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

	fmt.Println("\nTo start the Local Studio web server:")
	fmt.Println("  go run main.go -serve")
	fmt.Println("==================================================")
}

func startServer(s *store.FSStore, addr string) {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/status", func(w http.ResponseWriter, r *http.Request) {
		people, _ := s.ListPeople()
		families, _ := s.ListFamilies()
		sources, _ := s.ListSources()
		valid := s.ValidateAll() == nil

		writeJSON(w, http.StatusOK, map[string]any{
			"peopleCount":   len(people),
			"familiesCount": len(families),
			"sourcesCount":  len(sources),
			"valid":         valid,
		})
	})

	mux.HandleFunc("/api/people", func(w http.ResponseWriter, r *http.Request) {
		people, err := s.ListPeople()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, people)
	})

	mux.HandleFunc("/api/families", func(w http.ResponseWriter, r *http.Request) {
		families, err := s.ListFamilies()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, families)
	})

	mux.HandleFunc("/api/sources", func(w http.ResponseWriter, r *http.Request) {
		sources, err := s.ListSources()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, sources)
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}

		people, _ := s.ListPeople()
		families, _ := s.ListFamilies()
		sources, _ := s.ListSources()
		validErr := s.ValidateAll()

		validStatus := "<span style='color: green;'>✓ Valid</span>"
		if validErr != nil {
			validStatus = fmt.Sprintf("<span style='color: red;'>✗ Error: %s</span>", validErr.Error())
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Genea — Local Studio</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px auto; max-width: 800px; line-height: 1.6; color: #333; }
    h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
    .card { background: #f9f9f9; border: 1px solid #ddd; border-radius: 6px; padding: 15px 20px; margin-bottom: 20px; }
    .stats { display: flex; gap: 20px; }
    .stat-box { flex: 1; background: #fff; border: 1px solid #ccc; border-radius: 4px; padding: 10px; text-align: center; }
    .stat-number { font-size: 24px; font-weight: bold; color: #0066cc; }
    ul { list-style-type: none; padding-left: 0; }
    li { padding: 6px 0; border-bottom: 1px solid #eee; }
    code { background: #eee; padding: 2px 5px; border-radius: 3px; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Genea Local Studio</h1>
  <div class="card">
    <p><strong>Graph Integrity:</strong> %s</p>
    <div class="stats">
      <div class="stat-box"><div class="stat-number">%d</div>People</div>
      <div class="stat-box"><div class="stat-number">%d</div>Families</div>
      <div class="stat-box"><div class="stat-number">%d</div>Sources</div>
    </div>
  </div>

  <h2>People</h2>
  <ul>`, validStatus, len(people), len(families), len(sources))

		for _, p := range people {
			display := p.ID
			if len(p.Names) > 0 {
				display = p.Names[0].Display
			}
			fmt.Fprintf(w, "<li><code>%s</code> <strong>%s</strong> (%s)</li>\n", p.ID, display, p.Sex)
		}

		fmt.Fprintf(w, `  </ul>

  <h2>Families</h2>
  <ul>`)

		for _, f := range families {
			fmt.Fprintf(w, "<li><code>%s</code> Partners: %v &bull; Children: %d</li>\n", f.ID, f.PartnerIDs, len(f.Children))
		}

		fmt.Fprintf(w, `  </ul>

  <h2>Sources</h2>
  <ul>`)

		for _, s := range sources {
			fmt.Fprintf(w, "<li><code>%s</code> <strong>%s</strong> (%s)</li>\n", s.ID, s.Title, s.Repository)
		}

		fmt.Fprintf(w, `  </ul>
</body>
</html>`)
	})

	log.Printf("Starting Genea Local Studio at http://localhost%s (serving %s)\n", addr, s.RootDir)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}
