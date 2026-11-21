package store

import (
	"fmt"
	"regexp"
)

var (
	personIDRe = regexp.MustCompile(`^p_[a-zA-Z0-9_-]+$`)
	familyIDRe = regexp.MustCompile(`^f_[a-zA-Z0-9_-]+$`)
	sourceIDRe = regexp.MustCompile(`^s_[a-zA-Z0-9_-]+$`)
)

func ValidatePerson(p Person) error {
	if !personIDRe.MatchString(p.ID) {
		return fmt.Errorf("invalid person id %q: must match ^p_[a-zA-Z0-9_-]+$", p.ID)
	}
	if len(p.Names) == 0 || p.Names[0].Given == "" {
		return fmt.Errorf("person %s must have at least one name with a given name", p.ID)
	}
	switch p.Sex {
	case SexFemale, SexMale, SexIntersex, SexUnknown:
	default:
		return fmt.Errorf("person %s has invalid sex %q", p.ID, p.Sex)
	}
	for _, ev := range p.Events {
		if err := ValidateEvent(ev); err != nil {
			return fmt.Errorf("person %s: %w", p.ID, err)
		}
	}
	return nil
}

func ValidateFamily(f Family) error {
	if !familyIDRe.MatchString(f.ID) {
		return fmt.Errorf("invalid family id %q", f.ID)
	}
	if len(f.PartnerIDs) > 2 {
		return fmt.Errorf("family %s cannot have more than 2 partners", f.ID)
	}
	for _, ev := range f.Events {
		if err := ValidateEvent(ev); err != nil {
			return fmt.Errorf("family %s: %w", f.ID, err)
		}
	}
	return nil
}

func ValidateEvent(ev LifeEvent) error {
	if ev.ID == "" || ev.Type == "" {
		return fmt.Errorf("event requires non-empty id and type")
	}
	if ev.Date != nil {
		if ev.Date.Month < 0 || ev.Date.Month > 12 {
			return fmt.Errorf("event %s: invalid month %d", ev.ID, ev.Date.Month)
		}
		if ev.Date.Day < 0 || ev.Date.Day > 31 {
			return fmt.Errorf("event %s: invalid day %d", ev.ID, ev.Date.Day)
		}
	}
	return nil
}
