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
	LifeEventBirth     LifeEventType = "birth"
	LifeEventMarriage  LifeEventType = "marriage"
	LifeEventDeath     LifeEventType = "death"
	LifeEventResidence LifeEventType = "residence"
)

// Alias for LifeEventType and alternative constant names.
type EventType = LifeEventType

const (
	EventTypeBirth     = LifeEventBirth
	EventTypeMarriage  = LifeEventMarriage
	EventTypeDeath     = LifeEventDeath
	EventTypeResidence = LifeEventResidence

	EventBirth     = LifeEventBirth
	EventMarriage  = LifeEventMarriage
	EventDeath     = LifeEventDeath
	EventResidence = LifeEventResidence
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

type Sex string

const (
	SexFemale   Sex = "female"
	SexMale     Sex = "male"
	SexIntersex Sex = "intersex"
	SexUnknown  Sex = "unknown"
)

type Person struct {
	ID                string      `json:"id"`
	Names             []Name      `json:"names"`
	Sex               Sex         `json:"sex"` // female, male, intersex, unknown
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
