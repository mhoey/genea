package site

import (
	"encoding/json"
	"fmt"

	"github.com/mhoey/genea/internal/store"
)

// BundleData represents the complete consolidated genealogy dataset for static consumption.
type BundleData struct {
	People   []store.Person `json:"people"`
	Families []store.Family `json:"families"`
	Sources  []store.Source `json:"sources"`
}

// CreateBundle extracts and validates all archive data from the provided store into a bundle.
func CreateBundle(s *store.FSStore) (*BundleData, error) {
	if err := s.ValidateAll(); err != nil {
		return nil, fmt.Errorf("archive validation failed: %w", err)
	}

	people, err := s.ListPeople()
	if err != nil {
		return nil, fmt.Errorf("list people: %w", err)
	}

	families, err := s.ListFamilies()
	if err != nil {
		return nil, fmt.Errorf("list families: %w", err)
	}

	sources, err := s.ListSources()
	if err != nil {
		return nil, fmt.Errorf("list sources: %w", err)
	}

	if people == nil {
		people = []store.Person{}
	}
	if families == nil {
		families = []store.Family{}
	}
	if sources == nil {
		sources = []store.Source{}
	}

	return &BundleData{
		People:   people,
		Families: families,
		Sources:  sources,
	}, nil
}

// ToJSON serializes the bundle into formatted JSON.
func (b *BundleData) ToJSON() ([]byte, error) {
	return json.MarshalIndent(b, "", "  ")
}

// ToJS serializes the bundle into a JavaScript file setting window.GENEA_DATA.
func (b *BundleData) ToJS() ([]byte, error) {
	jsonData, err := b.ToJSON()
	if err != nil {
		return nil, err
	}
	content := append([]byte("window.GENEA_DATA = "), jsonData...)
	content = append(content, []byte(";\n")...)
	return content, nil
}
