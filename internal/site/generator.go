package site

import (
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/mhoey/genea/internal/store"
)

//go:embed templates/*
var templatesFS embed.FS

// GenerateSite generates the complete static genealogy web application into the specified output directory.
func GenerateSite(s *store.FSStore, outputDir string) error {
	bundle, err := CreateBundle(s)
	if err != nil {
		return fmt.Errorf("failed to create data bundle: %w", err)
	}

	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return fmt.Errorf("failed to create output directory %s: %w", outputDir, err)
	}

	// Extract embedded template files
	err = fs.WalkDir(templatesFS, "templates", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		relPath, err := filepath.Rel("templates", path)
		if err != nil {
			return err
		}
		if relPath == "." {
			return nil
		}

		targetPath := filepath.Join(outputDir, relPath)

		if d.IsDir() {
			return os.MkdirAll(targetPath, 0o755)
		}

		content, err := templatesFS.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read embedded file %s: %w", path, err)
		}

		if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
			return err
		}

		return os.WriteFile(targetPath, content, 0o644)
	})
	if err != nil {
		return fmt.Errorf("failed to extract web templates: %w", err)
	}

	// Write data.json
	jsonData, err := bundle.ToJSON()
	if err != nil {
		return fmt.Errorf("marshal data.json: %w", err)
	}
	if err := os.WriteFile(filepath.Join(outputDir, "data.json"), jsonData, 0o644); err != nil {
		return fmt.Errorf("write data.json: %w", err)
	}

	// Write data.js
	jsData, err := bundle.ToJS()
	if err != nil {
		return fmt.Errorf("marshal data.js: %w", err)
	}
	if err := os.WriteFile(filepath.Join(outputDir, "data.js"), jsData, 0o644); err != nil {
		return fmt.Errorf("write data.js: %w", err)
	}

	// Also write to data/ subfolder for flexibility
	dataSubDir := filepath.Join(outputDir, "data")
	if err := os.MkdirAll(dataSubDir, 0o755); err != nil {
		return fmt.Errorf("create data directory: %w", err)
	}
	if err := os.WriteFile(filepath.Join(dataSubDir, "data.json"), jsonData, 0o644); err != nil {
		return fmt.Errorf("write data/data.json: %w", err)
	}
	if err := os.WriteFile(filepath.Join(dataSubDir, "data.js"), jsData, 0o644); err != nil {
		return fmt.Errorf("write data/data.js: %w", err)
	}

	return nil
}
