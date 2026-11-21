// graph-store.js - In-memory graph index and genealogical queries

export class GraphStore {
  constructor(bundle = {}) {
    this.people = bundle.people || [];
    this.families = bundle.families || [];
    this.sources = bundle.sources || [];

    this.peopleById = new Map();
    this.familiesById = new Map();
    this.sourcesById = new Map();

    this.parentsByPersonId = new Map();
    this.spousesByPersonId = new Map();
    this.childrenByPersonId = new Map();
    this.familiesByPersonId = new Map();

    this._buildIndices();
  }

  _buildIndices() {
    for (const p of this.people) {
      this.peopleById.set(p.id, p);
      this.parentsByPersonId.set(p.id, []);
      this.spousesByPersonId.set(p.id, []);
      this.childrenByPersonId.set(p.id, []);
      this.familiesByPersonId.set(p.id, []);
    }

    for (const f of this.families) {
      this.familiesById.set(f.id, f);

      // Index spouses / partners
      const partners = (f.partnerIds || [])
        .map(id => this.peopleById.get(id))
        .filter(Boolean);

      const marriageEvent = (f.events || []).find(e => e.type === 'marriage');

      for (let i = 0; i < partners.length; i++) {
        const p1 = partners[i];
        this.familiesByPersonId.get(p1.id)?.push(f);

        for (let j = 0; j < partners.length; j++) {
          if (i !== j) {
            const p2 = partners[j];
            this.spousesByPersonId.get(p1.id)?.push({
              person: p2,
              family: f,
              marriageEvent
            });
          }
        }
      }

      // Index children & parents
      for (const childLink of (f.children || [])) {
        const childPerson = this.peopleById.get(childLink.personId);
        if (childPerson) {
          // Parents of this child are the partners of family f
          const parentsList = this.parentsByPersonId.get(childPerson.id);
          for (const partner of partners) {
            if (parentsList && !parentsList.some(p => p.id === partner.id)) {
              parentsList.push(partner);
            }
          }

          // Children of each partner
          for (const partner of partners) {
            const childrenList = this.childrenByPersonId.get(partner.id);
            if (childrenList && !childrenList.some(c => c.person.id === childPerson.id)) {
              childrenList.push({
                person: childPerson,
                relationship: childLink.relationshipToPartners || 'biological',
                familyId: f.id
              });
            }
          }
        }
      }
    }

    // Also link child's familyIdAsChild if set on person
    for (const p of this.people) {
      if (p.familyIdAsChild) {
        const f = this.familiesById.get(p.familyIdAsChild);
        if (f) {
          const partners = (f.partnerIds || [])
            .map(id => this.peopleById.get(id))
            .filter(Boolean);
          const parentsList = this.parentsByPersonId.get(p.id);
          for (const partner of partners) {
            if (parentsList && !parentsList.some(item => item.id === partner.id)) {
              parentsList.push(partner);
            }
          }
        }
      }
    }

    for (const s of this.sources) {
      this.sourcesById.set(s.id, s);
    }
  }

  getPerson(id) {
    return this.peopleById.get(id) || null;
  }

  getFamily(id) {
    return this.familiesById.get(id) || null;
  }

  getSource(id) {
    return this.sourcesById.get(id) || null;
  }

  getParents(personId) {
    return this.parentsByPersonId.get(personId) || [];
  }

  getSpouses(personId) {
    return this.spousesByPersonId.get(personId) || [];
  }

  getChildren(personId) {
    return this.childrenByPersonId.get(personId) || [];
  }

  getAllPeople() {
    return this.people;
  }

  getAllFamilies() {
    return this.families;
  }

  getAllSources() {
    return this.sources;
  }

  getDisplayName(person) {
    if (!person) return '';
    if (person.names && person.names.length > 0) {
      const primary = person.names[0];
      if (primary.display) return primary.display;
      const parts = [primary.given, primary.surname].filter(Boolean);
      if (parts.length > 0) return parts.join(' ');
    }
    return person.id;
  }

  getBirthYear(person) {
    if (!person || !person.events) return null;
    const b = person.events.find(e => e.type === 'birth');
    return b?.date?.year || null;
  }

  getDeathYear(person) {
    if (!person || !person.events) return null;
    const d = person.events.find(e => e.type === 'death');
    return d?.date?.year || null;
  }

  searchPeople(query) {
    if (!query || typeof query !== 'string') return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return this.people.filter(p => {
      if (p.id.toLowerCase().includes(q)) return true;
      for (const n of (p.names || [])) {
        if (n.display && n.display.toLowerCase().includes(q)) return true;
        if (n.given && n.given.toLowerCase().includes(q)) return true;
        if (n.surname && n.surname.toLowerCase().includes(q)) return true;
        if (n.maidenOrBirthSurname && n.maidenOrBirthSurname.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }

  findDefaultRootPerson() {
    if (this.people.length === 0) return null;

    // Prefer prominent person mentioned in spec / plan if present
    const specPreferred = this.getPerson('p_andreas_kristian_hoey');
    if (specPreferred) return specPreferred;

    // Find person with lowest birth year or earliest root with children
    const rootsWithChildren = this.people.filter(p => {
      const parents = this.getParents(p.id);
      const children = this.getChildren(p.id);
      return parents.length === 0 && children.length > 0;
    });

    if (rootsWithChildren.length > 0) {
      rootsWithChildren.sort((a, b) => {
        const ya = this.getBirthYear(a) || 9999;
        const yb = this.getBirthYear(b) || 9999;
        return ya - yb;
      });
      return rootsWithChildren[0];
    }

    return this.people[0];
  }
}
