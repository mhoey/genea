package store

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestDateQualifier(t *testing.T) {
	tests := []struct {
		qualifier DateQualifier
		expected  string
	}{
		{DateQualifierExact, "exact"},
		{DateQualifierAbout, "about"},
		{DateQualifierBefore, "before"},
		{DateQualifierAfter, "after"},
		{DateQualifierBetween, "between"},
		{QualifierExact, "exact"},
		{DateExact, "exact"},
	}

	for _, tt := range tests {
		if string(tt.qualifier) != tt.expected {
			t.Errorf("expected %q, got %q", tt.expected, tt.qualifier)
		}
	}
}

func TestLifeEventType(t *testing.T) {
	tests := []struct {
		eventType LifeEventType
		expected  string
	}{
		{LifeEventBirth, "birth"},
		{LifeEventBaptism, "baptism"},
		{LifeEventConfirmation, "confirmation"},
		{LifeEventMarriage, "marriage"},
		{LifeEventDeath, "death"},
		{LifeEventBurial, "burial"},
		{LifeEventResidence, "residence"},
		{LifeEventCensus, "census"},
		{LifeEventOccupation, "occupation"},
		{EventTypeBirth, "birth"},
		{EventTypeBaptism, "baptism"},
		{EventTypeConfirmation, "confirmation"},
		{EventTypeMarriage, "marriage"},
		{EventTypeDeath, "death"},
		{EventTypeBurial, "burial"},
		{EventTypeResidence, "residence"},
		{EventTypeCensus, "census"},
		{EventTypeOccupation, "occupation"},
		{EventBirth, "birth"},
		{EventBaptism, "baptism"},
		{EventConfirmation, "confirmation"},
		{EventMarriage, "marriage"},
		{EventDeath, "death"},
		{EventBurial, "burial"},
		{EventResidence, "residence"},
		{EventCensus, "census"},
		{EventOccupation, "occupation"},
	}

	for _, tt := range tests {
		if string(tt.eventType) != tt.expected {
			t.Errorf("expected %q, got %q", tt.expected, tt.eventType)
		}
	}
}

func TestIsSingleInstanceEvent(t *testing.T) {
	singleTypes := []LifeEventType{
		LifeEventBirth,
		LifeEventBaptism,
		LifeEventConfirmation,
		LifeEventDeath,
		LifeEventBurial,
	}

	for _, st := range singleTypes {
		if !IsSingleInstanceEvent(st) {
			t.Errorf("expected %s to be single instance event", st)
		}
	}

	multiTypes := []LifeEventType{
		LifeEventMarriage,
		LifeEventResidence,
		LifeEventCensus,
		LifeEventOccupation,
	}

	for _, mt := range multiTypes {
		if IsSingleInstanceEvent(mt) {
			t.Errorf("expected %s to allow multiple instances", mt)
		}
	}
}

func TestValidatePerson_DuplicateSingleEvents(t *testing.T) {
	singleTypes := []LifeEventType{
		LifeEventBirth,
		LifeEventBaptism,
		LifeEventConfirmation,
		LifeEventDeath,
		LifeEventBurial,
	}

	for _, st := range singleTypes {
		p := Person{
			ID:     "p_test_dup",
			Names:  []Name{{Given: "Test", Surname: "Person"}},
			Gender: GenderMale,
			Events: []LifeEvent{
				{ID: "e_1", Type: st},
				{ID: "e_2", Type: st},
			},
		}

		err := ValidatePerson(p)
		if err == nil {
			t.Errorf("expected error for duplicate %s events, got nil", st)
		} else if !strings.Contains(err.Error(), "cannot have multiple") {
			t.Errorf("expected 'cannot have multiple' in error, got: %v", err)
		}
	}

	// Multiple marriage or residence events should be valid
	pMulti := Person{
		ID:     "p_test_multi",
		Names:  []Name{{Given: "Test", Surname: "Person"}},
		Gender: GenderMale,
		Events: []LifeEvent{
			{ID: "e_m1", Type: LifeEventMarriage},
			{ID: "e_m2", Type: LifeEventMarriage},
			{ID: "e_r1", Type: LifeEventResidence},
			{ID: "e_r2", Type: LifeEventResidence},
		},
	}
	if err := ValidatePerson(pMulti); err != nil {
		t.Errorf("expected multiple marriages and residences to be valid, got: %v", err)
	}
}

func TestGender(t *testing.T) {
	tests := []struct {
		gender   Gender
		expected string
	}{
		{GenderFemale, "female"},
		{GenderMale, "male"},
		{GenderIntersex, "intersex"},
		{GenderUnknown, "unknown"},
	}

	for _, tt := range tests {
		if string(tt.gender) != tt.expected {
			t.Errorf("expected %q, got %q", tt.expected, tt.gender)
		}
	}
}

func TestChildRelationship(t *testing.T) {
	tests := []struct {
		rel      ChildRelationship
		expected string
	}{
		{ChildRelBiological, "biological"},
		{ChildRelAdopted, "adopted"},
		{ChildRelFoster, "foster"},
		{ChildRelStep, "step"},
		{ChildRelUnknown, "unknown"},
		{ChildRelationshipBiological, "biological"},
		{RelationshipBiological, "biological"},
	}

	for _, tt := range tests {
		if string(tt.rel) != tt.expected {
			t.Errorf("expected %q, got %q", tt.expected, tt.rel)
		}
	}
}

func TestJSONSerialization(t *testing.T) {
	p := Person{
		ID:     "p_test",
		Names:  []Name{{Given: "Jane", Surname: "Doe"}},
		Gender: GenderFemale,
		Living: true,
		Events: []LifeEvent{
			{
				ID:   "e_birth",
				Type: LifeEventBirth,
				Date: &GeneaDate{
					Qualifier: DateQualifierExact,
					Year:      1990,
				},
			},
		},
	}

	data, err := json.Marshal(p)
	if err != nil {
		t.Fatalf("failed to marshal person: %v", err)
	}

	var p2 Person
	if err := json.Unmarshal(data, &p2); err != nil {
		t.Fatalf("failed to unmarshal person: %v", err)
	}

	if p2.Gender != GenderFemale {
		t.Errorf("expected gender %q, got %q", GenderFemale, p2.Gender)
	}
	if len(p2.Events) != 1 || p2.Events[0].Type != LifeEventBirth {
		t.Errorf("expected event type %q, got %v", LifeEventBirth, p2.Events)
	}
	if p2.Events[0].Date.Qualifier != DateQualifierExact {
		t.Errorf("expected qualifier %q, got %q", DateQualifierExact, p2.Events[0].Date.Qualifier)
	}

	child := ChildLink{
		PersonID:               "p_child",
		RelationshipToPartners: ChildRelBiological,
	}
	childData, err := json.Marshal(child)
	if err != nil {
		t.Fatalf("failed to marshal child link: %v", err)
	}
	var child2 ChildLink
	if err := json.Unmarshal(childData, &child2); err != nil {
		t.Fatalf("failed to unmarshal child link: %v", err)
	}
	if child2.RelationshipToPartners != ChildRelBiological {
		t.Errorf("expected relationship %q, got %q", ChildRelBiological, child2.RelationshipToPartners)
	}
}

func TestUpdatePersonEvents(t *testing.T) {
	// Create a test store
	tempDir, err := os.MkdirTemp("", "genea_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	store, err := NewFSStore(tempDir)
	if err != nil {
		t.Fatalf("failed to create store: %v", err)
	}

	// Create a person
	person := Person{
		ID:     "p_test",
		Names:  []Name{{Given: "Jane", Surname: "Doe"}},
		Gender: GenderFemale,
		Living: true,
	}

	p, err := store.AddPerson(person)
	if err != nil {
		t.Fatalf("failed to add person: %v", err)
	}

	// Test updating events
	newEvents := []LifeEvent{
		{
			ID:   "e_birth",
			Type: LifeEventBirth,
			Date: &GeneaDate{
				Qualifier: DateQualifierExact,
				Year:      1990,
			},
		},
		{
			ID:   "e_death",
			Type: LifeEventDeath,
			Date: &GeneaDate{
				Qualifier: DateQualifierExact,
				Year:      2020,
			},
		},
	}

	p, err = store.UpdatePersonAttribute(p.ID, "events", newEvents)
	if err != nil {
		t.Fatalf("failed to update events: %v", err)
	}

	// Verify the events were updated
	if len(p.Events) != 2 {
		t.Errorf("expected 2 events, got %d", len(p.Events))
	}

	if p.Events[0].Type != LifeEventBirth {
		t.Errorf("expected birth event, got %q", p.Events[0].Type)
	}

	if p.Events[1].Type != LifeEventDeath {
		t.Errorf("expected death event, got %q", p.Events[1].Type)
	}

	// Verify the data was persisted
	p2, err := store.GetPerson(p.ID)
	if err != nil {
		t.Fatalf("failed to get person: %v", err)
	}

	if len(p2.Events) != 2 {
		t.Errorf("expected 2 events from disk, got %d", len(p2.Events))
	}

	if p2.Living {
		t.Errorf("expected living to be false after adding death event")
	}

	if p2.Events[0].SourceIDs == nil || p2.Events[1].SourceIDs == nil {
		t.Errorf("expected SourceIDs to be initialized")
	}
}

func TestUpdatePersonAttribute_Errors(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "genea_test_err")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	s, err := NewFSStore(tempDir)
	if err != nil {
		t.Fatalf("failed to create store: %v", err)
	}

	person := Person{
		ID:     "p_err_test",
		Names:  []Name{{Given: "Error", Surname: "Test"}},
		Gender: GenderMale,
		Living: true,
	}

	_, err = s.AddPerson(person)
	if err != nil {
		t.Fatalf("failed to add person: %v", err)
	}

	// Unsupported attribute
	_, err = s.UpdatePersonAttribute("p_err_test", "unsupported_attr", "val")
	if err == nil || !strings.Contains(err.Error(), "unsupported attribute") {
		t.Errorf("expected unsupported attribute error, got %v", err)
	}

	// Invalid events type
	_, err = s.UpdatePersonAttribute("p_err_test", "events", "not_a_slice")
	if err == nil || !strings.Contains(err.Error(), "events must be []LifeEvent") {
		t.Errorf("expected events type error, got %v", err)
	}

	// Invalid event validation (e.g. invalid month)
	invalidEvents := []LifeEvent{
		{
			ID:   "e_invalid",
			Type: LifeEventBirth,
			Date: &GeneaDate{
				Qualifier: DateQualifierExact,
				Year:      1990,
				Month:     15, // Invalid month > 12
			},
		},
	}
	_, err = s.UpdatePersonAttribute("p_err_test", "events", invalidEvents)
	if err == nil || !strings.Contains(err.Error(), "invalid month") {
		t.Errorf("expected validation error for invalid month, got %v", err)
	}

	// Non-existent person
	_, err = s.UpdatePersonAttribute("p_does_not_exist", "events", []LifeEvent{})
	if err == nil {
		t.Errorf("expected error for non-existent person, got nil")
	}

	// Other attribute type errors
	typeTests := []struct {
		attr  string
		value any
	}{
		{"gender", 123},
		{"living", "true"},
		{"notes", 123},
		{"given", 123},
		{"surname", 123},
		{"birth_date", "not_a_date"},
		{"death_date", "not_a_date"},
	}

	for _, tt := range typeTests {
		_, err := s.UpdatePersonAttribute("p_err_test", tt.attr, tt.value)
		if err == nil {
			t.Errorf("expected error for %s with value %v, got nil", tt.attr, tt.value)
		}
	}
}
