package store

import (
	"encoding/json"
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
		{LifeEventMarriage, "marriage"},
		{LifeEventDeath, "death"},
		{LifeEventResidence, "residence"},
		{EventTypeBirth, "birth"},
		{EventBirth, "birth"},
	}

	for _, tt := range tests {
		if string(tt.eventType) != tt.expected {
			t.Errorf("expected %q, got %q", tt.expected, tt.eventType)
		}
	}
}

func TestSex(t *testing.T) {
	tests := []struct {
		sex      Sex
		expected string
	}{
		{SexFemale, "female"},
		{SexMale, "male"},
		{SexIntersex, "intersex"},
		{SexUnknown, "unknown"},
	}

	for _, tt := range tests {
		if string(tt.sex) != tt.expected {
			t.Errorf("expected %q, got %q", tt.expected, tt.sex)
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
		Sex:    SexFemale,
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

	if p2.Sex != SexFemale {
		t.Errorf("expected sex %q, got %q", SexFemale, p2.Sex)
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
