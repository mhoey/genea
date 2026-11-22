package store

type DateQualifier string

const (
	DateQualifierExact   DateQualifier = "exact"
	DateQualifierAbout   DateQualifier = "about"
	DateQualifierBefore  DateQualifier = "before"
	DateQualifierAfter   DateQualifier = "after"
	DateQualifierBetween DateQualifier = "between"
)

// Alias for DateQualifier and alternative constant names.
type Qualifier = DateQualifier

const (
	QualifierExact   = DateQualifierExact
	QualifierAbout   = DateQualifierAbout
	QualifierBefore  = DateQualifierBefore
	QualifierAfter   = DateQualifierAfter
	QualifierBetween = DateQualifierBetween

	DateExact   = DateQualifierExact
	DateAbout   = DateQualifierAbout
	DateBefore  = DateQualifierBefore
	DateAfter   = DateQualifierAfter
	DateBetween = DateQualifierBetween
)

type GeneaDate struct {
	Qualifier DateQualifier `json:"qualifier"` // exact, about, before, after, between
	Year      int           `json:"year,omitempty"`
	Month     int           `json:"month,omitempty"`
	Day       int           `json:"day,omitempty"`
	EndYear   int           `json:"endYear,omitempty"`
	Raw       string        `json:"raw,omitempty"`
}

type Place struct {
	Name    string   `json:"name"`
	Country string   `json:"country,omitempty"`
	Lat     *float64 `json:"lat,omitempty"`
	Lng     *float64 `json:"lng,omitempty"`
}

type LifeEventType string

const (
	LifeEventBirth        LifeEventType = "birth"
	LifeEventBaptism      LifeEventType = "baptism"
	LifeEventConfirmation LifeEventType = "confirmation"
	LifeEventMarriage     LifeEventType = "marriage"
	LifeEventDeath        LifeEventType = "death"
	LifeEventBurial       LifeEventType = "burial"
	LifeEventResidence    LifeEventType = "residence"
	LifeEventCensus       LifeEventType = "census"
	LifeEventOccupation   LifeEventType = "occupation"
)

// Alias for LifeEventType and alternative constant names.
type EventType = LifeEventType

const (
	EventTypeBirth        = LifeEventBirth
	EventTypeBaptism      = LifeEventBaptism
	EventTypeConfirmation = LifeEventConfirmation
	EventTypeMarriage     = LifeEventMarriage
	EventTypeDeath        = LifeEventDeath
	EventTypeBurial       = LifeEventBurial
	EventTypeResidence    = LifeEventResidence
	EventTypeCensus       = LifeEventCensus
	EventTypeOccupation   = LifeEventOccupation

	EventBirth        = LifeEventBirth
	EventBaptism      = LifeEventBaptism
	EventConfirmation = LifeEventConfirmation
	EventMarriage     = LifeEventMarriage
	EventDeath        = LifeEventDeath
	EventBurial       = LifeEventBurial
	EventResidence    = LifeEventResidence
	EventCensus       = LifeEventCensus
	EventOccupation   = LifeEventOccupation
)

// IsSingleInstanceEvent returns true if the event type can only occur once per person
// (birth, baptism, confirmation, death, burial).
func IsSingleInstanceEvent(t LifeEventType) bool {
	switch t {
	case LifeEventBirth,
		LifeEventBaptism,
		LifeEventConfirmation,
		LifeEventDeath,
		LifeEventBurial:
		return true
	default:
		return false
	}
}

type RelationType string

const (
	RelSpouse RelationType = "spouse"
	RelChild  RelationType = "child"
)

type LifeEvent struct {
	ID          string        `json:"id"`
	Type        LifeEventType `json:"type"` // birth, marriage, death, residence, etc.
	Label       string        `json:"label,omitempty"`
	Date        *GeneaDate    `json:"date,omitempty"`
	Place       *Place        `json:"place,omitempty"`
	Description string        `json:"description,omitempty"`
	SourceIDs   []string      `json:"sourceIds"`
}

type Name struct {
	Given                string `json:"given"`
	Surname              string `json:"surname,omitempty"`
	MaidenOrBirthSurname string `json:"maidenOrBirthSurname,omitempty"`
	Suffix               string `json:"suffix,omitempty"`
	Display              string `json:"display,omitempty"`
}

type Gender string

const (
	GenderFemale   Gender = "female"
	GenderMale     Gender = "male"
	GenderIntersex Gender = "intersex"
	GenderUnknown  Gender = "unknown"
)

type Person struct {
	ID                string      `json:"id"`
	Names             []Name      `json:"names"`
	Gender            Gender      `json:"gender"` // female, male, intersex, unknown
	Living            bool        `json:"living"`
	Events            []LifeEvent `json:"events"`
	FamilyIDsAsSpouse []string    `json:"familyIdsAsSpouse"`
	FamilyIDAsChild   *string     `json:"familyIdAsChild"`
	Notes             string      `json:"notes,omitempty"`
}

type ChildRelationship string

const (
	ChildRelBiological ChildRelationship = "biological"
	ChildRelAdopted    ChildRelationship = "adopted"
	ChildRelFoster     ChildRelationship = "foster"
	ChildRelStep       ChildRelationship = "step"
	ChildRelUnknown    ChildRelationship = "unknown"
)

// Alias for ChildRelationship and alternative constant names.
type RelationshipToPartners = ChildRelationship

const (
	ChildRelationshipBiological = ChildRelBiological
	ChildRelationshipAdopted    = ChildRelAdopted
	ChildRelationshipFoster     = ChildRelFoster
	ChildRelationshipStep       = ChildRelStep
	ChildRelationshipUnknown    = ChildRelUnknown

	RelationshipBiological = ChildRelBiological
	RelationshipAdopted    = ChildRelAdopted
	RelationshipFoster     = ChildRelFoster
	RelationshipStep       = ChildRelStep
	RelationshipUnknown    = ChildRelUnknown
)

type ChildLink struct {
	PersonID               string            `json:"personId"`
	RelationshipToPartners ChildRelationship `json:"relationshipToPartners"` // biological, adopted, foster, step, unknown
}

type Family struct {
	ID         string      `json:"id"`
	PartnerIDs []string    `json:"partnerIds"`
	Children   []ChildLink `json:"children"`
	Events     []LifeEvent `json:"events"`
	Notes      string      `json:"notes,omitempty"`
}

type Source struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Author     string `json:"author,omitempty"`
	Repository string `json:"repository,omitempty"`
	Citation   string `json:"citation,omitempty"`
	URL        string `json:"url,omitempty"`
	Notes      string `json:"notes,omitempty"`
}
