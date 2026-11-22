package updateperson

import (
	"bufio"
	"os"
	"strings"
	"testing"

	"github.com/mhoey/genea/internal/store"
)

func createTestStore(t *testing.T) (*store.FSStore, string) {
	t.Helper()
	tempDir, err := os.MkdirTemp("", "genea_cmd_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	s, err := store.NewFSStore(tempDir)
	if err != nil {
		os.RemoveAll(tempDir)
		t.Fatalf("failed to create store: %v", err)
	}

	return s, tempDir
}

func TestGetPersonDisplayName(t *testing.T) {
	tests := []struct {
		name     string
		person   store.Person
		expected string
	}{
		{
			name: "with display name",
			person: store.Person{
				ID: "p_1",
				Names: []store.Name{
					{Given: "John", Surname: "Doe", Display: "John Doe"},
				},
			},
			expected: "John Doe",
		},
		{
			name: "without display name",
			person: store.Person{
				ID: "p_2",
				Names: []store.Name{
					{Given: "Jane", Surname: "Smith"},
				},
			},
			expected: "Jane Smith",
		},
		{
			name: "no names, fallback to ID",
			person: store.Person{
				ID:    "p_3",
				Names: []store.Name{},
			},
			expected: "p_3",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := getPersonDisplayName(tt.person)
			if got != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, got)
			}
		})
	}
}

func TestPersonHasName(t *testing.T) {
	p := store.Person{
		ID: "p_bent",
		Names: []store.Name{
			{Given: "Bent Linnet", Surname: "Høy", Display: "Bent Linnet Høy"},
		},
	}

	if !personHasName(p, "Bent") {
		t.Errorf("expected person to match 'Bent'")
	}
	if !personHasName(p, "linnet") {
		t.Errorf("expected person to match 'linnet' case-insensitively")
	}
	if !personHasName(p, "Høy") {
		t.Errorf("expected person to match 'Høy'")
	}
	if personHasName(p, "NonExistent") {
		t.Errorf("expected person not to match 'NonExistent'")
	}
}

func TestChangeLifeEvent(t *testing.T) {
	s, tempDir := createTestStore(t)
	defer os.RemoveAll(tempDir)

	person := store.Person{
		ID: "p_bent_linnet_hoey",
		Names: []store.Name{
			{Given: "Bent Linnet", Surname: "Høy", Display: "Bent Linnet Høy"},
		},
		Gender: store.GenderMale,
		Living: true,
		Events: []store.LifeEvent{
			{
				ID:   "e_p7_birth",
				Type: store.LifeEventBirth,
				Date: &store.GeneaDate{Qualifier: store.DateQualifierExact, Year: 1939, Month: 1, Day: 27},
			},
			{
				ID:   "e_death_4",
				Type: store.LifeEventDeath,
				Date: &store.GeneaDate{Qualifier: store.DateQualifierExact, Year: 2026, Month: 11, Day: 1},
			},
		},
	}

	_, err := s.AddPerson(person)
	if err != nil {
		t.Fatalf("failed to add person: %v", err)
	}

	// Simulate user input matching the user prompt:
	// Search: Bent
	// Select person: 1
	// Action: 6 (change_life_event)
	// Event: 2 (death event)
	// Qualifier: exact
	// Year: 2026
	// Month: 11
	// Day: 4
	input := strings.Join([]string{
		"Bent",
		"1",
		"6",
		"2",
		"exact",
		"2026",
		"11",
		"4",
	}, "\n") + "\n"

	scanner := bufio.NewScanner(strings.NewReader(input))
	err = UpdatePersonCommandWithScanner(scanner, s)
	if err != nil {
		t.Fatalf("UpdatePersonCommandWithScanner failed: %v", err)
	}

	updated, err := s.GetPerson("p_bent_linnet_hoey")
	if err != nil {
		t.Fatalf("failed to get person: %v", err)
	}

	if len(updated.Events) != 2 {
		t.Fatalf("expected 2 events, got %d", len(updated.Events))
	}

	deathEv := updated.Events[1]
	if deathEv.Type != store.LifeEventDeath {
		t.Errorf("expected death event, got %q", deathEv.Type)
	}
	if deathEv.Date == nil || deathEv.Date.Year != 2026 || deathEv.Date.Month != 11 || deathEv.Date.Day != 4 {
		t.Errorf("expected date 2026/11/4, got %+v", deathEv.Date)
	}
	if updated.Living {
		t.Errorf("expected Living to be false after updating death event")
	}
}

func TestChangeLifeEventWithPlace(t *testing.T) {
	s, tempDir := createTestStore(t)
	defer os.RemoveAll(tempDir)

	person := store.Person{
		ID: "p_change_place_test",
		Names: []store.Name{
			{Given: "ChangePlace", Surname: "Test"},
		},
		Gender: store.GenderMale,
		Living: true,
		Events: []store.LifeEvent{
			{
				ID:   "e_birth_0",
				Type: store.LifeEventBirth,
				Date: &store.GeneaDate{Qualifier: store.DateQualifierExact, Year: 1950, Month: 6, Day: 10},
			},
		},
	}

	_, err := s.AddPerson(person)
	if err != nil {
		t.Fatalf("failed to add person: %v", err)
	}

	// 1. Update event to add place: "Henne kirke", "Danmark"
	input := strings.Join([]string{
		"ChangePlace",
		"1",
		"6", // change_life_event
		"1", // 1st event
		"exact",
		"1950",
		"6",
		"10",
		"Henne kirke",
		"Danmark",
	}, "\n") + "\n"

	err = UpdatePersonCommandWithScanner(bufio.NewScanner(strings.NewReader(input)), s)
	if err != nil {
		t.Fatalf("failed to update event with place: %v", err)
	}

	p, _ := s.GetPerson("p_change_place_test")
	if p.Events[0].Place == nil || p.Events[0].Place.Name != "Henne kirke" || p.Events[0].Place.Country != "Danmark" {
		t.Fatalf("expected place 'Henne kirke, Danmark', got %+v", p.Events[0].Place)
	}

	// 2. Update event, press Enter for place to keep current place
	inputKeep := strings.Join([]string{
		"ChangePlace",
		"1",
		"6",
		"1",
		"exact",
		"1950",
		"6",
		"12", // new day
		"",   // press Enter to keep current place
	}, "\n") + "\n"

	err = UpdatePersonCommandWithScanner(bufio.NewScanner(strings.NewReader(inputKeep)), s)
	if err != nil {
		t.Fatalf("failed to update event keeping place: %v", err)
	}

	p, _ = s.GetPerson("p_change_place_test")
	if p.Events[0].Date.Day != 12 {
		t.Errorf("expected day 12, got %d", p.Events[0].Date.Day)
	}
	if p.Events[0].Place == nil || p.Events[0].Place.Name != "Henne kirke" {
		t.Fatalf("expected place to be preserved as 'Henne kirke', got %+v", p.Events[0].Place)
	}

	// 3. Update event and enter "-" to clear place
	inputClear := strings.Join([]string{
		"ChangePlace",
		"1",
		"6",
		"1",
		"exact",
		"1950",
		"6",
		"12",
		"-", // clear place
	}, "\n") + "\n"

	err = UpdatePersonCommandWithScanner(bufio.NewScanner(strings.NewReader(inputClear)), s)
	if err != nil {
		t.Fatalf("failed to update event clearing place: %v", err)
	}

	p, _ = s.GetPerson("p_change_place_test")
	if p.Events[0].Place != nil {
		t.Fatalf("expected place to be cleared (nil), got %+v", p.Events[0].Place)
	}
}

func TestAddLifeEvent(t *testing.T) {
	s, tempDir := createTestStore(t)
	defer os.RemoveAll(tempDir)

	person := store.Person{
		ID: "p_test_person",
		Names: []store.Name{
			{Given: "Test", Surname: "Person"},
		},
		Gender: store.GenderFemale,
		Living: true,
	}

	_, err := s.AddPerson(person)
	if err != nil {
		t.Fatalf("failed to add person: %v", err)
	}

	// Search: Test
	// Select person: 1
	// Action: 7 (add_life_event)
	// Event type: 1 (birth)
	// Qualifier: exact
	// Year: 1980
	// Month: 5
	// Day: 15
	input := strings.Join([]string{
		"Test",
		"1",
		"7",
		"1",
		"exact",
		"1980",
		"5",
		"15",
	}, "\n") + "\n"

	scanner := bufio.NewScanner(strings.NewReader(input))
	err = UpdatePersonCommandWithScanner(scanner, s)
	if err != nil {
		t.Fatalf("UpdatePersonCommandWithScanner failed: %v", err)
	}

	updated, err := s.GetPerson("p_test_person")
	if err != nil {
		t.Fatalf("failed to get person: %v", err)
	}

	if len(updated.Events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(updated.Events))
	}
	if updated.Events[0].Type != store.LifeEventBirth {
		t.Errorf("expected birth event, got %q", updated.Events[0].Type)
	}
	if updated.Events[0].Date.Year != 1980 || updated.Events[0].Date.Month != 5 || updated.Events[0].Date.Day != 15 {
		t.Errorf("expected 1980/5/15, got %+v", updated.Events[0].Date)
	}
	if updated.Events[0].SourceIDs == nil {
		t.Errorf("expected SourceIDs to be non-nil slice")
	}
	if updated.Events[0].Label != "Birth" {
		t.Errorf("expected label 'Birth', got %q", updated.Events[0].Label)
	}
}

func TestAddPederKristianHoeyEvents(t *testing.T) {
	s, tempDir := createTestStore(t)
	defer os.RemoveAll(tempDir)

	person := store.Person{
		ID: "p_peder_kristian_hoey",
		Names: []store.Name{
			{Given: "Peder Kristian", Surname: "Høy", Display: "Peder Kristian Høy"},
		},
		Gender: store.GenderMale,
		Living: true,
	}

	_, err := s.AddPerson(person)
	if err != nil {
		t.Fatalf("failed to add person: %v", err)
	}

	// Test adding all event types found in peder_kristian_hoey.json:
	// 1: birth, 2: baptism, 3: confirmation, 4: marriage, 5: death, 6: burial
	eventsToAdd := []struct {
		typeIndex    string
		expectedType store.LifeEventType
		expectedLbl  string
		year         string
	}{
		{"1", store.LifeEventBirth, "Birth", "1891"},
		{"2", store.LifeEventBaptism, "Baptism", "1891"},
		{"3", store.LifeEventConfirmation, "Confirmation", "1905"},
		{"4", store.LifeEventMarriage, "Marriage", "1920"},
		{"5", store.LifeEventDeath, "Death", "1970"},
		{"6", store.LifeEventBurial, "Burial", "1970"},
	}

	for _, ev := range eventsToAdd {
		input := strings.Join([]string{
			"Peder",
			"1",
			"7",
			ev.typeIndex,
			"exact",
			ev.year,
			"", // month
			"", // day
		}, "\n") + "\n"

		scanner := bufio.NewScanner(strings.NewReader(input))
		err = UpdatePersonCommandWithScanner(scanner, s)
		if err != nil {
			t.Fatalf("failed to add event type %s: %v", ev.expectedType, err)
		}
	}

	updated, err := s.GetPerson("p_peder_kristian_hoey")
	if err != nil {
		t.Fatalf("failed to get person: %v", err)
	}

	if len(updated.Events) != 6 {
		t.Fatalf("expected 6 events, got %d", len(updated.Events))
	}

	for i, ev := range eventsToAdd {
		if updated.Events[i].Type != ev.expectedType {
			t.Errorf("event %d: expected type %q, got %q", i, ev.expectedType, updated.Events[i].Type)
		}
		if updated.Events[i].Label != ev.expectedLbl {
			t.Errorf("event %d: expected label %q, got %q", i, ev.expectedLbl, updated.Events[i].Label)
		}
	}

	if updated.Living {
		t.Errorf("expected Living to be false after adding death and burial events")
	}
}

func TestAddEventWithPlace(t *testing.T) {
	s, tempDir := createTestStore(t)
	defer os.RemoveAll(tempDir)

	person := store.Person{
		ID: "p_place_test",
		Names: []store.Name{
			{Given: "Place", Surname: "Test"},
		},
		Gender: store.GenderMale,
		Living: true,
	}

	_, err := s.AddPerson(person)
	if err != nil {
		t.Fatalf("failed to add person: %v", err)
	}

	// Search: Place
	// Select person: 1
	// Action: 7 (add_life_event)
	// Event type: 1 (birth)
	// Qualifier: exact
	// Year: 1891
	// Month: 3
	// Day: 1
	// Place name: Tebelgård, Henne sogn
	// Country: Danmark
	input := strings.Join([]string{
		"Place",
		"1",
		"7",
		"1",
		"exact",
		"1891",
		"3",
		"1",
		"Tebelgård, Henne sogn",
		"Danmark",
	}, "\n") + "\n"

	scanner := bufio.NewScanner(strings.NewReader(input))
	err = UpdatePersonCommandWithScanner(scanner, s)
	if err != nil {
		t.Fatalf("UpdatePersonCommandWithScanner failed: %v", err)
	}

	updated, err := s.GetPerson("p_place_test")
	if err != nil {
		t.Fatalf("failed to get person: %v", err)
	}

	if len(updated.Events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(updated.Events))
	}
	if updated.Events[0].Place == nil {
		t.Fatalf("expected place to be non-nil")
	}
	if updated.Events[0].Place.Name != "Tebelgård, Henne sogn" {
		t.Errorf("expected place name 'Tebelgård, Henne sogn', got %q", updated.Events[0].Place.Name)
	}
	if updated.Events[0].Place.Country != "Danmark" {
		t.Errorf("expected place country 'Danmark', got %q", updated.Events[0].Place.Country)
	}
}

func TestAddDuplicateSingleEventFails(t *testing.T) {
	s, tempDir := createTestStore(t)
	defer os.RemoveAll(tempDir)

	person := store.Person{
		ID: "p_dup_single",
		Names: []store.Name{
			{Given: "Single", Surname: "Event"},
		},
		Gender: store.GenderFemale,
		Living: true,
		Events: []store.LifeEvent{
			{
				ID:   "e_birth_0",
				Type: store.LifeEventBirth,
				Date: &store.GeneaDate{Qualifier: store.DateQualifierExact, Year: 1990},
			},
		},
	}

	_, err := s.AddPerson(person)
	if err != nil {
		t.Fatalf("failed to add person: %v", err)
	}

	// Try to add another birth event (type 1)
	input := strings.Join([]string{
		"Single",
		"1",
		"7",
		"1", // birth again
	}, "\n") + "\n"

	scanner := bufio.NewScanner(strings.NewReader(input))
	err = UpdatePersonCommandWithScanner(scanner, s)
	if err == nil {
		t.Fatalf("expected error when adding duplicate birth event, got nil")
	}
	if !strings.Contains(err.Error(), "already has a birth event") {
		t.Errorf("expected 'already has a birth event' in error, got: %v", err)
	}

	// Multiple marriage events (type 4) should succeed
	inputMarriage1 := strings.Join([]string{
		"Single",
		"1",
		"7",
		"4", // marriage
		"exact",
		"2010",
		"",
		"",
		"", // skip place
	}, "\n") + "\n"
	err = UpdatePersonCommandWithScanner(bufio.NewScanner(strings.NewReader(inputMarriage1)), s)
	if err != nil {
		t.Fatalf("failed to add first marriage: %v", err)
	}

	inputMarriage2 := strings.Join([]string{
		"Single",
		"1",
		"7",
		"4", // marriage again
		"exact",
		"2020",
		"",
		"",
		"", // skip place
	}, "\n") + "\n"
	err = UpdatePersonCommandWithScanner(bufio.NewScanner(strings.NewReader(inputMarriage2)), s)
	if err != nil {
		t.Fatalf("failed to add second marriage: %v", err)
	}

	p, _ := s.GetPerson("p_dup_single")
	var marriageCount int
	for _, ev := range p.Events {
		if ev.Type == store.LifeEventMarriage {
			marriageCount++
		}
	}
	if marriageCount != 2 {
		t.Errorf("expected 2 marriage events, got %d", marriageCount)
	}
}

func TestUpdatePersonBasicAttributes(t *testing.T) {
	s, tempDir := createTestStore(t)
	defer os.RemoveAll(tempDir)

	person := store.Person{
		ID: "p_test_attr",
		Names: []store.Name{
			{Given: "OldGiven", Surname: "OldSurname"},
		},
		Gender: store.GenderUnknown,
		Living: true,
	}

	_, err := s.AddPerson(person)
	if err != nil {
		t.Fatalf("failed to add person: %v", err)
	}

	// Test updating gender
	input := strings.Join([]string{"attr", "1", "1", "female"}, "\n") + "\n"
	err = UpdatePersonCommandWithScanner(bufio.NewScanner(strings.NewReader(input)), s)
	if err != nil {
		t.Fatalf("failed to update gender: %v", err)
	}
	p, _ := s.GetPerson("p_test_attr")
	if p.Gender != store.GenderFemale {
		t.Errorf("expected gender female, got %q", p.Gender)
	}

	// Test updating living
	input = strings.Join([]string{"attr", "1", "2", "false"}, "\n") + "\n"
	err = UpdatePersonCommandWithScanner(bufio.NewScanner(strings.NewReader(input)), s)
	if err != nil {
		t.Fatalf("failed to update living: %v", err)
	}
	p, _ = s.GetPerson("p_test_attr")
	if p.Living != false {
		t.Errorf("expected living false, got %t", p.Living)
	}

	// Test updating notes
	input = strings.Join([]string{"attr", "1", "3", "Some notes here"}, "\n") + "\n"
	err = UpdatePersonCommandWithScanner(bufio.NewScanner(strings.NewReader(input)), s)
	if err != nil {
		t.Fatalf("failed to update notes: %v", err)
	}
	p, _ = s.GetPerson("p_test_attr")
	if p.Notes != "Some notes here" {
		t.Errorf("expected notes 'Some notes here', got %q", p.Notes)
	}

	// Test updating given name
	input = strings.Join([]string{"attr", "1", "4", "NewGiven"}, "\n") + "\n"
	err = UpdatePersonCommandWithScanner(bufio.NewScanner(strings.NewReader(input)), s)
	if err != nil {
		t.Fatalf("failed to update given name: %v", err)
	}
	p, _ = s.GetPerson("p_test_attr")
	if p.Names[0].Given != "NewGiven" {
		t.Errorf("expected given NewGiven, got %q", p.Names[0].Given)
	}

	// Test updating surname
	input = strings.Join([]string{"attr", "1", "5", "NewSurname"}, "\n") + "\n"
	err = UpdatePersonCommandWithScanner(bufio.NewScanner(strings.NewReader(input)), s)
	if err != nil {
		t.Fatalf("failed to update surname: %v", err)
	}
	p, _ = s.GetPerson("p_test_attr")
	if p.Names[0].Surname != "NewSurname" {
		t.Errorf("expected surname NewSurname, got %q", p.Names[0].Surname)
	}
}

func TestQuitAndEmptySearch(t *testing.T) {
	s, tempDir := createTestStore(t)
	defer os.RemoveAll(tempDir)

	// Empty search
	err := UpdatePersonCommandWithScanner(bufio.NewScanner(strings.NewReader("\n")), s)
	if err != nil {
		t.Errorf("expected nil error on empty search, got %v", err)
	}

	// No match
	err = UpdatePersonCommandWithScanner(bufio.NewScanner(strings.NewReader("NotFound\n")), s)
	if err != nil {
		t.Errorf("expected nil error on not found, got %v", err)
	}

	// Quit during selection
	person := store.Person{
		ID:     "p_quit_test",
		Names:  []store.Name{{Given: "Quit", Surname: "Test"}},
		Gender: store.GenderMale,
	}
	s.AddPerson(person)

	err = UpdatePersonCommandWithScanner(bufio.NewScanner(strings.NewReader("Quit\nq\n")), s)
	if err != nil {
		t.Errorf("expected nil error on quit, got %v", err)
	}
}
