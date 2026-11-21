package store

type RelationType string

const (
	RelSpouse RelationType = "spouse"
	RelChild  RelationType = "child"
)

type GenealogyStore interface {
	// People
	GetPerson(id string) (*Person, error)
	ListPeople() ([]Person, error)
	AddPerson(p Person) (*Person, error)
	UpdatePersonAttribute(id string, attr string, value any) (*Person, error)

	// Families & Relations
	GetFamily(id string) (*Family, error)
	ListFamilies() ([]Family, error)
	CreateFamily(f Family) (*Family, error)
	AddSpouseRelation(familyID, personID string) error
	AddChildRelation(familyID, childPersonID, relKind string) error

	// Events (targetID can be a person ID "p_..." or family ID "f_...")
	AddEvent(targetID string, ev LifeEvent) error

	// Sources
	AddSource(s Source) (*Source, error)
	ListSources() ([]Source, error)

	// Full Repository Integrity Check
	ValidateAll() error
}
