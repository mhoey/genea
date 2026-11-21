package store

import (
	"path/filepath"
	"testing"
)

func TestDataDirectoryIntegrity(t *testing.T) {
	dataPath := filepath.Join("..", "..", "data")
	store, err := NewFSStore(dataPath)
	if err != nil {
		t.Fatalf("failed to create FSStore: %v", err)
	}

	peopleIDs := []string{
		"p_john_doe",
		"p_mary_smith",
		"p_robert_doe",
		"p_emily_doe",
		"p_sarah_johnson",
		"p_thomas_doe",
		"p_alice_doe",
	}

	for _, pid := range peopleIDs {
		p, err := store.GetPerson(pid)
		if err != nil {
			t.Errorf("failed to get person %s: %v", pid, err)
			continue
		}
		if err := ValidatePerson(*p); err != nil {
			t.Errorf("person %s failed validation: %v", pid, err)
		}
		for _, ev := range p.Events {
			for _, sid := range ev.SourceIDs {
				src, err := readJSON[Source](store.sourcePath(sid))
				if err != nil {
					t.Errorf("person %s event %s references missing source %s: %v", pid, ev.ID, sid, err)
				} else if src.ID != sid {
					t.Errorf("expected source id %s, got %s", sid, src.ID)
				}
			}
		}
	}

	familyIDs := []string{
		"f_doe_smith",
		"f_doe_johnson",
	}

	for _, fid := range familyIDs {
		f, err := store.GetFamily(fid)
		if err != nil {
			t.Errorf("failed to get family %s: %v", fid, err)
			continue
		}
		if err := ValidateFamily(*f); err != nil {
			t.Errorf("family %s failed validation: %v", fid, err)
		}
		for _, pid := range f.PartnerIDs {
			p, err := store.GetPerson(pid)
			if err != nil {
				t.Errorf("family %s references missing partner %s: %v", fid, pid, err)
			} else {
				found := false
				for _, fID := range p.FamilyIDsAsSpouse {
					if fID == fid {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("partner %s does not link back to family %s", pid, fid)
				}
			}
		}
		for _, child := range f.Children {
			p, err := store.GetPerson(child.PersonID)
			if err != nil {
				t.Errorf("family %s references missing child %s: %v", fid, child.PersonID, err)
			} else if p.FamilyIDAsChild == nil || *p.FamilyIDAsChild != fid {
				t.Errorf("child %s does not link back to family %s as child", child.PersonID, fid)
			}
		}
		for _, ev := range f.Events {
			for _, sid := range ev.SourceIDs {
				src, err := readJSON[Source](store.sourcePath(sid))
				if err != nil {
					t.Errorf("family %s event %s references missing source %s: %v", fid, ev.ID, sid, err)
				} else if src.ID != sid {
					t.Errorf("expected source id %s, got %s", sid, src.ID)
				}
			}
		}
	}
}
