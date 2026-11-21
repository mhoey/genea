package store

type GeneaDate struct {
	Qualifier string `json:"qualifier"` // exact, about, before, after, between
	Year      int    `json:"year,omitempty"`
	Month     int    `json:"month,omitempty"`
	Day       int    `json:"day,omitempty"`
	EndYear   int    `json:"endYear,omitempty"`
	Raw       string `json:"raw,omitempty"`
}

type Place struct {
	Name    string   `json:"name"`
	Country string   `json:"country,omitempty"`
	Lat     *float64 `json:"lat,omitempty"`
	Lng     *float64 `json:"lng,omitempty"`
}

type LifeEvent struct {
	ID          string     `json:"id"`
	Type        string     `json:"type"` // birth, marriage, death, residence, etc.
	Label       string     `json:"label,omitempty"`
	Date        *GeneaDate `json:"date,omitempty"`
	Place       *Place     `json:"place,omitempty"`
	Description string     `json:"description,omitempty"`
	SourceIDs   []string   `json:"sourceIds"`
}

type Name struct {
	Given               string `json:"given"`
	Surname             string `json:"surname,omitempty"`
	MaidenOrBirthSurname string `json:"maidenOrBirthSurname,omitempty"`
	Suffix              string `json:"suffix,omitempty"`
	Display             string `json:"display,omitempty"`
}

type Person struct {
	ID                string      `json:"id"`
	Names             []Name      `json:"names"`
	Sex               string      `json:"sex"` // female, male, intersex, unknown
	Living            bool        `json:"living"`
	Events            []LifeEvent `json:"events"`
	FamilyIDsAsSpouse []string    `json:"familyIdsAsSpouse"`
	FamilyIDAsChild   *string     `json:"familyIdAsChild"`
	Notes             string      `json:"notes,omitempty"`
}

type ChildLink struct {
	PersonID               string `json:"personId"`
	RelationshipToPartners string `json:"relationshipToPartners"` // biological, adopted, foster, step, unknown
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
