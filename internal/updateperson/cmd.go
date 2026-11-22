package updateperson

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/mhoey/genea/internal/store"
)

// UpdatePersonCommand handles updating person records
func UpdatePersonCommand(s *store.FSStore) error {
	return UpdatePersonCommandWithScanner(bufio.NewScanner(os.Stdin), s)
}

// UpdatePersonCommandWithScanner handles updating person records with a provided scanner
func UpdatePersonCommandWithScanner(scanner *bufio.Scanner, s *store.FSStore) error {

	// Search for a person by name
	fmt.Print("Enter part of a person's name to search: ")
	scanner.Scan()
	searchTerm := strings.TrimSpace(scanner.Text())

	if searchTerm == "" {
		fmt.Println("Search term cannot be empty")
		return nil
	}

	// Get all people and filter by search term
	allPeople, err := s.ListPeople()
	if err != nil {
		return fmt.Errorf("failed to list people: %w", err)
	}

	var matchingPeople []store.Person
	for _, person := range allPeople {
		if strings.Contains(strings.ToLower(person.ID), strings.ToLower(searchTerm)) ||
			personHasName(person, searchTerm) {
			matchingPeople = append(matchingPeople, person)
		}
	}

	if len(matchingPeople) == 0 {
		fmt.Println("No people found matching your search term")
		return nil
	}

	// Display up to 10 matching people
	maxDisplay := 10
	if len(matchingPeople) < maxDisplay {
		maxDisplay = len(matchingPeople)
	}

	fmt.Printf("\nFound %d person(s). Showing first %d:\n", len(matchingPeople), maxDisplay)
	for i, person := range matchingPeople[:maxDisplay] {
		displayName := getPersonDisplayName(person)
		fmt.Printf("%d. [%s] %s\n", i+1, person.ID, displayName)
	}

	if len(matchingPeople) > maxDisplay {
		fmt.Printf("... and %d more\n", len(matchingPeople)-maxDisplay)
	}

	// Let user select a person
	var selectedPerson *store.Person
	for {
		fmt.Print("\nEnter the number of the person to update (or 's' to search again, 'q' to quit): ")
		scanner.Scan()
		input := strings.TrimSpace(scanner.Text())

		if input == "q" || input == "quit" {
			return nil
		}

		if input == "s" || input == "search" {
			return UpdatePersonCommandWithScanner(scanner, s)
		}

		var selectedIndex int
		_, err := fmt.Sscanf(input, "%d", &selectedIndex)
		if err != nil || selectedIndex < 1 || selectedIndex > maxDisplay {
			fmt.Println("Invalid selection. Please enter a valid number or 's'/'q'")
			continue
		}

		selectedPerson = &matchingPeople[selectedIndex-1]
		break
	}

	// Show person details that will be updated
	displayPerson(selectedPerson)

	// Display main menu options
	fmt.Println("\nAvailable actions:")
	actions := []struct {
		name string
		desc string
	}{
		{"gender", "Person's gender (male, female, intersex, unknown)"},
		{"living", "Living status (true/false)"},
		{"notes", "Personal notes"},
		{"given", "Given name"},
		{"surname", "Surname"},
		{"change_life_event", "Change existing life events"},
		{"add_life_event", "Add new life event"},
	}

	for i, action := range actions {
		fmt.Printf("%d. %s - %s\n", i+1, action.name, action.desc)
	}

	// Let user select action
	var selectedAction int
	for {
		fmt.Print("\nEnter the number of action to perform: ")
		scanner.Scan()
		input := strings.TrimSpace(scanner.Text())

		_, err := fmt.Sscanf(input, "%d", &selectedAction)
		if err != nil || selectedAction < 1 || selectedAction > len(actions) {
			fmt.Println("Invalid selection. Please enter a valid number")
			continue
		}
		break
	}

	// Process selected action
	switch actions[selectedAction-1].name {
	case "gender":
		newValue := getGenderValue(scanner)
		_, err = s.UpdatePersonAttribute(selectedPerson.ID, "gender", newValue)
		if err != nil {
			return fmt.Errorf("failed to update gender: %w", err)
		}
		fmt.Printf("Successfully updated gender for person [%s]\n", selectedPerson.ID)
		return nil
	case "living":
		newValue := getBooleanValue(scanner)
		_, err = s.UpdatePersonAttribute(selectedPerson.ID, "living", newValue)
		if err != nil {
			return fmt.Errorf("failed to update living status: %w", err)
		}
		fmt.Printf("Successfully updated living status for person [%s]\n", selectedPerson.ID)
		return nil
	case "notes":
		newValue := getStringValue(scanner, "Enter new notes: ")
		_, err = s.UpdatePersonAttribute(selectedPerson.ID, "notes", newValue)
		if err != nil {
			return fmt.Errorf("failed to update notes: %w", err)
		}
		fmt.Printf("Successfully updated notes for person [%s]\n", selectedPerson.ID)
		return nil
	case "given":
		newValue := getStringValue(scanner, "Enter new given name: ")
		_, err = s.UpdatePersonAttribute(selectedPerson.ID, "given", newValue)
		if err != nil {
			return fmt.Errorf("failed to update given name: %w", err)
		}
		fmt.Printf("Successfully updated given name for person [%s]\n", selectedPerson.ID)
		return nil
	case "surname":
		newValue := getStringValue(scanner, "Enter new surname: ")
		_, err = s.UpdatePersonAttribute(selectedPerson.ID, "surname", newValue)
		if err != nil {
			return fmt.Errorf("failed to update surname: %w", err)
		}
		fmt.Printf("Successfully updated surname for person [%s]\n", selectedPerson.ID)
		return nil
	case "change_life_event":
		return handleLifeEventChange(scanner, s, selectedPerson)
	case "add_life_event":
		return handleLifeEventAdd(scanner, s, selectedPerson)
	default:
		fmt.Printf("Unsupported action: %s\n", actions[selectedAction-1].name)
		return nil
	}
}

func getPersonDisplayName(p store.Person) string {
	if len(p.Names) > 0 {
		if p.Names[0].Display != "" {
			return p.Names[0].Display
		} else {
			return fmt.Sprintf("%s %s", p.Names[0].Given, p.Names[0].Surname)
		}
	}
	return p.ID
}

func personHasName(p store.Person, searchTerm string) bool {
	searchTerm = strings.ToLower(searchTerm)
	for _, name := range p.Names {
		if strings.Contains(strings.ToLower(name.Given), searchTerm) ||
			strings.Contains(strings.ToLower(name.Surname), searchTerm) ||
			strings.Contains(strings.ToLower(name.Display), searchTerm) {
			return true
		}
	}
	return false
}

func displayPerson(p *store.Person) {
	fmt.Printf("\nPerson to update:\n")
	fmt.Printf("  ID: %s\n", p.ID)
	displayName := getPersonDisplayName(*p)
	fmt.Printf("  Name: %s\n", displayName)
	fmt.Printf("  Gender: %s\n", p.Gender)
	fmt.Printf("  Living: %t\n", p.Living)
	if p.Notes != "" {
		fmt.Printf("  Notes: %s\n", p.Notes)
	}
}

func getGenderValue(scanner *bufio.Scanner) store.Gender {
	for {
		fmt.Print("Enter gender (male/female/intersex/unknown): ")
		scanner.Scan()
		gender := strings.TrimSpace(strings.ToLower(scanner.Text()))

		switch gender {
		case "male", "female", "intersex", "unknown":
			return store.Gender(gender)
		default:
			fmt.Println("Invalid gender. Please enter male, female, intersex, or unknown")
		}
	}
}

func getBooleanValue(scanner *bufio.Scanner) bool {
	for {
		fmt.Print("Enter boolean value (true/false): ")
		scanner.Scan()
		value := strings.TrimSpace(strings.ToLower(scanner.Text()))

		switch value {
		case "true", "1", "yes", "y":
			return true
		case "false", "0", "no", "n":
			return false
		default:
			fmt.Println("Invalid boolean value. Please enter true or false")
		}
	}
}

func getStringValue(scanner *bufio.Scanner, prompt string) string {
	fmt.Print(prompt)
	scanner.Scan()
	return strings.TrimSpace(scanner.Text())
}

func handleLifeEventChange(scanner *bufio.Scanner, s *store.FSStore, person *store.Person) error {
	// List existing life events
	fmt.Println("\nExisting life events:")
	if len(person.Events) == 0 {
		fmt.Println("No life events found.")
		return nil
	}

	for i, event := range person.Events {
		fmt.Printf("%d. %s", i+1, event.Type)
		if event.Date != nil {
			fmt.Printf(" - %d/%d/%d", event.Date.Year, event.Date.Month, event.Date.Day)
		}
		if event.Place != nil && event.Place.Name != "" {
			fmt.Printf(" (%s)", event.Place.Name)
		}
		fmt.Println()
	}

	// Let user select an event to change
	var selectedEventIndex int
	for {
		fmt.Print("\nEnter the number of the event to change (or 0 to cancel): ")
		scanner.Scan()
		input := strings.TrimSpace(scanner.Text())

		_, err := fmt.Sscanf(input, "%d", &selectedEventIndex)
		if err != nil || selectedEventIndex < 0 || selectedEventIndex > len(person.Events) {
			fmt.Println("Invalid selection. Please enter a valid number or 0 to cancel")
			continue
		}
		break
	}

	if selectedEventIndex == 0 {
		return nil
	}

	selectedEvent := person.Events[selectedEventIndex-1]
	fmt.Printf("\nChanging event: %s\n", selectedEvent.Type)

	// Get new date value for the selected event
	newDate := getDateValue(scanner, "date")

	// Get optional place for the selected event
	newPlace := getOptionalPlaceForUpdate(scanner, selectedEvent.Place)

	// Update the event with new date and place
	updatedEvents := make([]store.LifeEvent, len(person.Events))
	copy(updatedEvents, person.Events)
	updatedEvents[selectedEventIndex-1].Date = &newDate
	updatedEvents[selectedEventIndex-1].Place = newPlace

	// Reconstruct person with updated events
	updatedPerson := *person
	updatedPerson.Events = updatedEvents

	// Save to store
	_, err := s.UpdatePersonAttribute(person.ID, "events", updatedPerson.Events)
	if err != nil {
		return fmt.Errorf("failed to update event: %w", err)
	}

	fmt.Printf("Successfully updated event for person [%s]\n", person.ID)
	return nil
}

func defaultLabel(eventType string) string {
	switch eventType {
	case "birth":
		return "Birth"
	case "baptism":
		return "Baptism"
	case "confirmation":
		return "Confirmation"
	case "marriage":
		return "Marriage"
	case "death":
		return "Death"
	case "burial":
		return "Burial"
	case "residence":
		return "Residence"
	case "census":
		return "Census"
	case "occupation":
		return "Occupation"
	default:
		if len(eventType) > 0 {
			return strings.ToUpper(eventType[:1]) + eventType[1:]
		}
		return ""
	}
}

func personHasEventType(person *store.Person, eventType store.LifeEventType) bool {
	for _, ev := range person.Events {
		if ev.Type == eventType {
			return true
		}
	}
	return false
}

func getOptionalPlace(scanner *bufio.Scanner) *store.Place {
	return getOptionalPlaceForUpdate(scanner, nil)
}

func getOptionalPlaceForUpdate(scanner *bufio.Scanner, currentPlace *store.Place) *store.Place {
	if currentPlace != nil && currentPlace.Name != "" {
		fmt.Printf("Current place: %s\n", currentPlace.Name)
		fmt.Print("Enter place name (optional, press Enter to keep current, '-' to clear): ")
	} else {
		fmt.Print("Enter place name (optional, press Enter to skip): ")
	}

	if !scanner.Scan() {
		return currentPlace
	}
	name := strings.TrimSpace(scanner.Text())
	if name == "" {
		return currentPlace
	}
	if name == "-" || strings.ToLower(name) == "none" {
		return nil
	}

	fmt.Print("Enter country (optional, press Enter to skip): ")
	var country string
	if scanner.Scan() {
		country = strings.TrimSpace(scanner.Text())
	}

	place := &store.Place{
		Name: name,
	}
	if country != "" {
		place.Country = country
	}
	return place
}

func handleLifeEventAdd(scanner *bufio.Scanner, s *store.FSStore, person *store.Person) error {
	// List available event types
	eventTypes := []string{
		"birth",
		"baptism",
		"confirmation",
		"marriage",
		"death",
		"burial",
		"residence",
		"census",
		"occupation",
	}

	fmt.Println("\nAvailable life event types:")
	for i, eventType := range eventTypes {
		status := ""
		if store.IsSingleInstanceEvent(store.LifeEventType(eventType)) && personHasEventType(person, store.LifeEventType(eventType)) {
			status = " (already set)"
		}
		fmt.Printf("%d. %s%s\n", i+1, eventType, status)
	}

	// Let user select an event type
	var selectedEventTypeIndex int
	for {
		fmt.Print("\nEnter the number of event type to add: ")
		if !scanner.Scan() {
			return nil
		}
		input := strings.TrimSpace(scanner.Text())

		_, err := fmt.Sscanf(input, "%d", &selectedEventTypeIndex)
		if err != nil || selectedEventTypeIndex < 1 || selectedEventTypeIndex > len(eventTypes) {
			fmt.Println("Invalid selection. Please enter a valid number")
			continue
		}

		eventType := eventTypes[selectedEventTypeIndex-1]
		if store.IsSingleInstanceEvent(store.LifeEventType(eventType)) && personHasEventType(person, store.LifeEventType(eventType)) {
			fmt.Printf("Person [%s] already has a %s event. %s can only have one event.\n", person.ID, eventType, eventType)
			return fmt.Errorf("person [%s] already has a %s event", person.ID, eventType)
		}
		break
	}

	eventType := eventTypes[selectedEventTypeIndex-1]
	fmt.Printf("\nAdding new %s event...\n", eventType)

	// Get date for the new event
	newDate := getDateValue(scanner, "date")

	// Get optional place for the new event
	place := getOptionalPlace(scanner)

	// Create new event
	newEvent := store.LifeEvent{
		ID:        "e_" + eventType + "_" + fmt.Sprintf("%d", len(person.Events)),
		Type:      store.LifeEventType(eventType),
		Label:     defaultLabel(eventType),
		Date:      &newDate,
		Place:     place,
		SourceIDs: []string{},
	}

	// Add event to person's events
	updatedEvents := append(person.Events, newEvent)

	// Save to store
	_, err := s.UpdatePersonAttribute(person.ID, "events", updatedEvents)
	if err != nil {
		return fmt.Errorf("failed to add event: %w", err)
	}

	fmt.Printf("Successfully added %s event for person [%s]\n", eventType, person.ID)
	return nil
}

func getDateValue(scanner *bufio.Scanner, attrName string) store.GeneaDate {
	var qualifier store.DateQualifier
	for {
		fmt.Print("Enter date qualifier (exact/about/before/after/between): ")
		scanner.Scan()
		n := strings.TrimSpace(strings.ToLower(scanner.Text()))

		switch n {
		case "exact", "about", "before", "after", "between":
			qualifier = store.DateQualifier(n)
		default:
			fmt.Println("Invalid qualifier. Please enter exact, about, before, after, or between")
			continue
		}
		break
	}

	var date store.GeneaDate
	date.Qualifier = qualifier

	if qualifier == store.DateBetween {
		// Handle between dates - need two dates
		fmt.Print("Enter start year: ")
		scanner.Scan()
		startYear, err := strconv.Atoi(strings.TrimSpace(scanner.Text()))
		if err != nil {
			fmt.Println("Invalid year. Using 0 for start year.")
			startYear = 0
		}
		date.Year = startYear

		fmt.Print("Enter end year: ")
		scanner.Scan()
		endYear, err := strconv.Atoi(strings.TrimSpace(scanner.Text()))
		if err != nil {
			fmt.Println("Invalid year. Using 0 for end year.")
			endYear = 0
		}
		date.EndYear = endYear

		return date
	}

	// Handle single date values
	if qualifier == store.DateAbout || qualifier == store.DateExact {
		fmt.Print("Enter year: ")
		scanner.Scan()
		year, err := strconv.Atoi(strings.TrimSpace(scanner.Text()))
		if err != nil {
			fmt.Println("Invalid year. Using 0 for year.")
			year = 0
		}
		date.Year = year

		fmt.Print("Enter month (optional, 1-12): ")
		scanner.Scan()
		monthStr := strings.TrimSpace(scanner.Text())
		if monthStr != "" {
			month, err := strconv.Atoi(monthStr)
			if err == nil && month >= 1 && month <= 12 {
				date.Month = month
			}
		}

		fmt.Print("Enter day (optional, 1-31): ")
		scanner.Scan()
		dayStr := strings.TrimSpace(scanner.Text())
		if dayStr != "" {
			day, err := strconv.Atoi(dayStr)
			if err == nil && day >= 1 && day <= 31 {
				date.Day = day
			}
		}
	} else {
		// For before/after - just year is sufficient
		fmt.Print("Enter year: ")
		scanner.Scan()
		year, err := strconv.Atoi(strings.TrimSpace(scanner.Text()))
		if err != nil {
			fmt.Println("Invalid year. Using 0 for year.")
			year = 0
		}
		date.Year = year
	}

	return date
}
