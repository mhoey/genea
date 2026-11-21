package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

type FSStore struct {
	RootDir string // e.g. "./data"
}

func NewFSStore(rootDir string) (*FSStore, error) {
	for _, sub := range []string{"people", "families", "sources"} {
		if err := os.MkdirAll(filepath.Join(rootDir, sub), 0o755); err != nil {
			return nil, err
		}
	}
	return &FSStore{RootDir: rootDir}, nil
}

func (s *FSStore) personPath(id string) string {
	return filepath.Join(s.RootDir, "people", id+".json")
}

func (s *FSStore) familyPath(id string) string {
	return filepath.Join(s.RootDir, "families", id+".json")
}

func (s *FSStore) sourcePath(id string) string {
	return filepath.Join(s.RootDir, "sources", id+".json")
}

func writeJSONAtomic(path string, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func readJSON[T any](path string) (*T, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var out T
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	return &out, nil
}

// --- People Operations ---

func (s *FSStore) GetPerson(id string) (*Person, error) {
	if !personIDRe.MatchString(id) {
		return nil, fmt.Errorf("invalid person id %q", id)
	}
	return readJSON[Person](s.personPath(id))
}

func (s *FSStore) AddPerson(p Person) (*Person, error) {
	if p.Events == nil {
		p.Events = []LifeEvent{}
	}
	if p.FamilyIDsAsSpouse == nil {
		p.FamilyIDsAsSpouse = []string{}
	}
	if err := ValidatePerson(p); err != nil {
		return nil, err
	}
	path := s.personPath(p.ID)
	if _, err := os.Stat(path); err == nil {
		return nil, fmt.Errorf("person %s already exists", p.ID)
	}
	if err := writeJSONAtomic(path, p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *FSStore) UpdatePersonAttribute(id string, attr string, value any) (*Person, error) {
	p, err := s.GetPerson(id)
	if err != nil {
		return nil, err
	}

	switch attr {
	case "sex":
		switch v := value.(type) {
		case Sex:
			p.Sex = v
		case string:
			p.Sex = Sex(v)
		default:
			return nil, fmt.Errorf("sex must be string")
		}
	case "living":
		v, ok := value.(bool)
		if !ok {
			return nil, fmt.Errorf("living must be bool")
		}
		p.Living = v
	case "notes":
		v, ok := value.(string)
		if !ok {
			return nil, fmt.Errorf("notes must be string")
		}
		p.Notes = v
	case "given":
		v, ok := value.(string)
		if !ok {
			return nil, fmt.Errorf("given must be string")
		}
		p.Names[0].Given = v
	case "surname":
		v, ok := value.(string)
		if !ok {
			return nil, fmt.Errorf("surname must be string")
		}
		p.Names[0].Surname = v
	default:
		return nil, fmt.Errorf("unsupported attribute %q", attr)
	}

	if err := ValidatePerson(*p); err != nil {
		return nil, err
	}
	if err := writeJSONAtomic(s.personPath(id), p); err != nil {
		return nil, err
	}
	return p, nil
}

// --- Events ---

func (s *FSStore) AddEvent(targetID string, ev LifeEvent) error {
	if ev.SourceIDs == nil {
		ev.SourceIDs = []string{}
	}
	if err := ValidateEvent(ev); err != nil {
		return err
	}
	// Verify all referenced sources exist
	for _, sid := range ev.SourceIDs {
		if _, err := os.Stat(s.sourcePath(sid)); err != nil {
			return fmt.Errorf("referenced source %s does not exist", sid)
		}
	}

	switch {
	case strings.HasPrefix(targetID, "p_"):
		p, err := s.GetPerson(targetID)
		if err != nil {
			return err
		}
		p.Events = append(p.Events, ev)
		return writeJSONAtomic(s.personPath(targetID), p)

	case strings.HasPrefix(targetID, "f_"):
		f, err := s.GetFamily(targetID)
		if err != nil {
			return err
		}
		f.Events = append(f.Events, ev)
		return writeJSONAtomic(s.familyPath(targetID), f)

	default:
		return fmt.Errorf("targetID %q must start with p_ or f_", targetID)
	}
}

// --- Families & Relations ---

func (s *FSStore) GetFamily(id string) (*Family, error) {
	if !familyIDRe.MatchString(id) {
		return nil, fmt.Errorf("invalid family id %q", id)
	}
	return readJSON[Family](s.familyPath(id))
}

func (s *FSStore) CreateFamily(f Family) (*Family, error) {
	if f.PartnerIDs == nil {
		f.PartnerIDs = []string{}
	}
	if f.Children == nil {
		f.Children = []ChildLink{}
	}
	if f.Events == nil {
		f.Events = []LifeEvent{}
	}
	if err := ValidateFamily(f); err != nil {
		return nil, err
	}
	path := s.familyPath(f.ID)
	if _, err := os.Stat(path); err == nil {
		return nil, fmt.Errorf("family %s already exists", f.ID)
	}
	if err := writeJSONAtomic(path, f); err != nil {
		return nil, err
	}
	return &f, nil
}

func (s *FSStore) AddSpouseRelation(familyID, personID string) error {
	f, err := s.GetFamily(familyID)
	if err != nil {
		return err
	}
	p, err := s.GetPerson(personID)
	if err != nil {
		return err
	}

	if !slices.Contains(f.PartnerIDs, personID) {
		f.PartnerIDs = append(f.PartnerIDs, personID)
		if err := ValidateFamily(*f); err != nil {
			return err
		}
		if err := writeJSONAtomic(s.familyPath(familyID), f); err != nil {
			return err
		}
	}

	if !slices.Contains(p.FamilyIDsAsSpouse, familyID) {
		p.FamilyIDsAsSpouse = append(p.FamilyIDsAsSpouse, familyID)
		if err := writeJSONAtomic(s.personPath(personID), p); err != nil {
			return err
		}
	}
	return nil
}

func (s *FSStore) AddChildRelation(familyID, childPersonID, relKind string) error {
	if relKind == "" {
		relKind = string(ChildRelBiological)
	}
	f, err := s.GetFamily(familyID)
	if err != nil {
		return err
	}
	p, err := s.GetPerson(childPersonID)
	if err != nil {
		return err
	}

	exists := false
	for _, c := range f.Children {
		if c.PersonID == childPersonID {
			exists = true
			break
		}
	}
	if !exists {
		f.Children = append(f.Children, ChildLink{
			PersonID:               childPersonID,
			RelationshipToPartners: ChildRelationship(relKind),
		})
		if err := writeJSONAtomic(s.familyPath(familyID), f); err != nil {
			return err
		}
	}

	p.FamilyIDAsChild = &familyID
	return writeJSONAtomic(s.personPath(childPersonID), p)
}
