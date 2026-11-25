// state.js - URL hash routing, application selection state, and "Focus on Person" search

import { clearChildren, createHTML } from './utils/dom.js';

export class AppState {
  /**
   * @param {GraphStore} graphStore
   * @param {Object} options
   * @param {Function} options.onSelectPerson - (personId, fromHashChange, openModal) => void
   * @param {Function} options.onViewModeChange - (mode) => void
   * @param {Function} options.onFocusUniqueMatch - (personId) => void
   */
  constructor(graphStore, options = {}) {
    this.graphStore = graphStore;
    this.options = options;

    this.selectedPersonId = null;
    this.viewMode = 'network'; // 'network' or 'hourglass'
    this._suppressNextHashChange = false;
    this._searchInputEl = null;

    this._bindHashChange();
  }

  initFromHash() {
    this._parseHash(false);
  }

  _bindHashChange() {
    window.addEventListener('hashchange', () => {
      if (this._suppressNextHashChange) {
        this._suppressNextHashChange = false;
        return;
      }
      this._parseHash(true);
    });
  }

  formatPersonLabel(person) {
    if (!person) return '';
    const name = this.graphStore.getDisplayName(person);
    const by = this.graphStore.getBirthYear(person);
    const dy = this.graphStore.getDeathYear(person);
    if (by || dy) {
      return `${name} (${by || '?'} – ${person.living ? 'Levende' : (dy || '?')})`;
    }
    return name;
  }

  syncInputWithSelectedPerson(force = false) {
    if (!this._searchInputEl || !this.selectedPersonId) return;
    if (!force && document.activeElement === this._searchInputEl) return;
    const person = this.graphStore.getPerson(this.selectedPersonId);
    if (person) {
      this._searchInputEl.value = this.formatPersonLabel(person);
    }
  }

  _parseHash(fromUserNav = false) {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);

    const personId = params.get('person');
    const view = params.get('view');

    if (view && (view === 'hourglass' || view === 'network')) {
      if (this.viewMode !== view) {
        this.viewMode = view;
        if (this.options.onViewModeChange) {
          this.options.onViewModeChange(view);
        }
      }
    }

    if (personId && this.graphStore.getPerson(personId)) {
      const personChanged = this.selectedPersonId !== personId;
      this.selectedPersonId = personId;
      this.syncInputWithSelectedPerson();
      if (this.options.onSelectPerson && (personChanged || !fromUserNav)) {
        this.options.onSelectPerson(personId, fromUserNav, false);
      }
    } else if (!this.selectedPersonId) {
      const def = this.graphStore.findDefaultRootPerson();
      if (def) {
        this.selectPerson(def.id, false, false);
      }
    }
  }

  selectPerson(personId, openModal = true, pushHistory = true) {
    if (!this.graphStore.getPerson(personId)) return;

    this.selectedPersonId = personId;
    this.syncInputWithSelectedPerson();

    if (pushHistory) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      params.set('person', personId);
      if (this.viewMode) params.set('view', this.viewMode);
      const nextHash = params.toString();
      if (window.location.hash.slice(1) !== nextHash) {
        this._suppressNextHashChange = true;
        window.location.hash = nextHash;
      }
    }

    if (this.options.onSelectPerson) {
      this.options.onSelectPerson(personId, false, openModal);
    }
  }

  setViewMode(mode) {
    if (this.viewMode === mode) return;
    this.viewMode = mode;

    const params = new URLSearchParams(window.location.hash.slice(1));
    if (this.selectedPersonId) params.set('person', this.selectedPersonId);
    params.set('view', mode);
    const nextHash = params.toString();
    if (window.location.hash.slice(1) !== nextHash) {
      this._suppressNextHashChange = true;
      window.location.hash = nextHash;
    }

    if (this.options.onViewModeChange) {
      this.options.onViewModeChange(mode);
    }
  }

  /**
   * Binds the "Focus on Person" search input and dropdown.
   * Displays the currently selected person when idle, and searches in real time when typing.
   * @param {HTMLInputElement} inputEl
   * @param {HTMLElement} resultsContainerEl
   */
  bindFocusPersonInput(inputEl, resultsContainerEl) {
    if (!inputEl || !resultsContainerEl) return;
    this._searchInputEl = inputEl;

    let debounceTimer = null;

    const performSearch = () => {
      const query = inputEl.value.trim();
      clearChildren(resultsContainerEl);

      if (!query) {
        resultsContainerEl.classList.remove('active');
        return;
      }

      const matches = this.graphStore.searchPeople(query);

      if (matches.length === 1) {
        const uniqueMatch = matches[0];
        if (this.options.onFocusUniqueMatch) {
          this.options.onFocusUniqueMatch(uniqueMatch.id);
        }
      }

      if (matches.length === 0) {
        resultsContainerEl.appendChild(createHTML('div', {
          className: 'search-empty',
          textContent: 'Ingen personer fundet'
        }));
        resultsContainerEl.classList.add('active');
        return;
      }

      const list = createHTML('ul', { className: 'search-results-list' });
      for (const p of matches.slice(0, 12)) {
        const name = this.graphStore.getDisplayName(p);
        const birthYear = this.graphStore.getBirthYear(p);
        const deathYear = this.graphStore.getDeathYear(p);
        let yearSpan = '';
        if (birthYear || deathYear) {
          yearSpan = ` (${birthYear || '?'} – ${p.living ? 'Levende' : (deathYear || '?')})`;
        }

        const li = createHTML('li', {
          className: `search-result-item ${p.id === this.selectedPersonId ? 'active' : ''}`,
          role: 'button',
          tabindex: '0'
        }, [
          createHTML('span', { className: 'result-name', textContent: name }),
          createHTML('span', { className: 'result-dates', textContent: yearSpan })
        ]);

        li.addEventListener('click', () => {
          resultsContainerEl.classList.remove('active');
          this.selectPerson(p.id, false);
          this.syncInputWithSelectedPerson(true);
          if (this.options.onFocusUniqueMatch) {
            this.options.onFocusUniqueMatch(p.id);
          }
        });

        list.appendChild(li);
      }

      resultsContainerEl.appendChild(list);
      resultsContainerEl.classList.add('active');
    };

    inputEl.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(performSearch, 150);
    });

    inputEl.addEventListener('focus', () => {
      inputEl.select();
    });

    inputEl.addEventListener('blur', () => {
      setTimeout(() => {
        if (!resultsContainerEl.classList.contains('active')) {
          this.syncInputWithSelectedPerson(true);
        }
      }, 150);
    });

    document.addEventListener('click', (e) => {
      if (!inputEl.contains(e.target) && !resultsContainerEl.contains(e.target)) {
        resultsContainerEl.classList.remove('active');
        this.syncInputWithSelectedPerson();
      }
    });

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        resultsContainerEl.classList.remove('active');
        this.syncInputWithSelectedPerson(true);
        inputEl.blur();
      }
    });
  }
}
