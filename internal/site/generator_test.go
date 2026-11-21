package site_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/mhoey/genea/internal/site"
	"github.com/mhoey/genea/internal/store"
)

func setupTestStore(t *testing.T) (*store.FSStore, string) {
	t.Helper()
	tmpDir := t.TempDir()
	fsStore, err := store.NewFSStore(tmpDir)
	if err != nil {
		t.Fatalf("failed to create test store: %v", err)
	}

	p1 := store.Person{
		ID: "p_john_doe",
		Names: []store.Name{
			{Given: "John", Surname: "Doe", Display: "John Doe"},
		},
		Sex:    store.SexMale,
		Living: false,
		Events: []store.LifeEvent{
			{
				ID:   "e_birth",
				Type: store.LifeEventBirth,
				Date: &store.GeneaDate{
					Qualifier: store.DateQualifierExact,
					Year:      1920,
					Month:     5,
					Day:       10,
				},
				Place: &store.Place{
					Name:    "London",
					Country: "UK",
				},
			},
		},
	}
	if _, err := fsStore.AddPerson(p1); err != nil {
		t.Fatalf("failed to add person: %v", err)
	}

	p2 := store.Person{
		ID: "p_jane_smith",
		Names: []store.Name{
			{Given: "Jane", Surname: "Smith", Display: "Jane Smith"},
		},
		Sex:    store.SexFemale,
		Living: true,
	}
	if _, err := fsStore.AddPerson(p2); err != nil {
		t.Fatalf("failed to add person: %v", err)
	}

	fam := store.Family{
		ID:         "f_doe_smith",
		PartnerIDs: []string{"p_john_doe", "p_jane_smith"},
	}
	if _, err := fsStore.CreateFamily(fam); err != nil {
		t.Fatalf("failed to add family: %v", err)
	}
	if err := fsStore.AddSpouseRelation("f_doe_smith", "p_john_doe"); err != nil {
		t.Fatalf("failed to add spouse relation: %v", err)
	}
	if err := fsStore.AddSpouseRelation("f_doe_smith", "p_jane_smith"); err != nil {
		t.Fatalf("failed to add spouse relation: %v", err)
	}

	src := store.Source{
		ID:    "s_census_1930",
		Title: "1930 UK Census",
	}
	if _, err := fsStore.AddSource(src); err != nil {
		t.Fatalf("failed to add source: %v", err)
	}

	return fsStore, tmpDir
}

func TestCreateBundle(t *testing.T) {
	fsStore, _ := setupTestStore(t)

	bundle, err := site.CreateBundle(fsStore)
	if err != nil {
		t.Fatalf("CreateBundle failed: %v", err)
	}

	if len(bundle.People) != 2 {
		t.Errorf("expected 2 people, got %d", len(bundle.People))
	}
	if len(bundle.Families) != 1 {
		t.Errorf("expected 1 family, got %d", len(bundle.Families))
	}
	if len(bundle.Sources) != 1 {
		t.Errorf("expected 1 source, got %d", len(bundle.Sources))
	}

	// Test ToJSON
	jsonData, err := bundle.ToJSON()
	if err != nil {
		t.Fatalf("ToJSON failed: %v", err)
	}
	var parsed site.BundleData
	if err := json.Unmarshal(jsonData, &parsed); err != nil {
		t.Fatalf("invalid json generated: %v", err)
	}

	// Test ToJS
	jsData, err := bundle.ToJS()
	if err != nil {
		t.Fatalf("ToJS failed: %v", err)
	}
	jsStr := string(jsData)
	if !strings.HasPrefix(jsStr, "window.GENEA_DATA = ") {
		t.Errorf("expected jsData to start with window.GENEA_DATA =, got: %s", jsStr[:30])
	}
	if !strings.HasSuffix(jsStr, ";\n") {
		t.Errorf("expected jsData to end with ;\n")
	}
}

func TestGenerateSite(t *testing.T) {
	fsStore, _ := setupTestStore(t)
	outDir := t.TempDir()

	err := site.GenerateSite(fsStore, outDir)
	if err != nil {
		t.Fatalf("GenerateSite failed: %v", err)
	}

	expectedFiles := []string{
		"index.html",
		"data.json",
		"data.js",
		"data/data.json",
		"data/data.js",
		"css/main.css",
		"css/tree.css",
		"css/controls.css",
		"css/modal.css",
		"js/app.js",
		"js/state.js",
		"js/graph-store.js",
		"js/layout/tree-layout.js",
		"js/layout/bezier.js",
		"js/viewport/svg-viewport.js",
		"js/viewport/scrollbars.js",
		"js/viewport/controls.js",
		"js/components/node-card.js",
		"js/components/person-modal.js",
		"js/utils/date-format.js",
		"js/utils/dom.js",
	}

	for _, rel := range expectedFiles {
		p := filepath.Join(outDir, rel)
		stat, err := os.Stat(p)
		if err != nil {
			t.Errorf("expected file %s does not exist: %v", rel, err)
			continue
		}
		if stat.Size() == 0 {
			t.Errorf("file %s is empty", rel)
		}
	}

	// Verify index.html contains necessary markup
	indexContent, err := os.ReadFile(filepath.Join(outDir, "index.html"))
	if err != nil {
		t.Fatalf("read index.html: %v", err)
	}
	indexStr := string(indexContent)
	if !strings.Contains(indexStr, "id=\"tree-svg\"") {
		t.Errorf("index.html missing tree-svg")
	}
	if !strings.Contains(indexStr, "id=\"person-dialog\"") {
		t.Errorf("index.html missing person-dialog")
	}
	if !strings.Contains(indexStr, "id=\"focus-person-input\"") {
		t.Errorf("index.html missing focus-person-input")
	}
}
