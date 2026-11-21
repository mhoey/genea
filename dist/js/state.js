// state.js - URL hash routing, application selection state, and "Focus on Person" search

import { clearChildren, createHTML } from './utils/dom.js';

export class AppState {
  /**
   * @param {GraphStore} graphStore
   * @param {Object} options
   * @param {Function} options.onSelectPerson - (personId, fromHashChange) => void
   * @param {Function} options.onViewModeChange - (mode) => void
   * @param {Function} options.onFocusUniqueMatch - (personId) => void
   */
  constructor(graphStore, options = {}) {
    this.graphStore = graphStore;
    this.options = options;

    this.selectedPersonId = null;
    this.viewMode = 'hourglass'; // 'hourglass' or 'network'

    this._bindHashChange();
  }

  initFromHash() {
    this._parseHash();
  }

  _bindHashChange() {
    window.addEventListener('hashchange', () => {
      this._parseHash(true);
    });
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
      this.selectedPersonId = personId;
      if (this.options.onSelectPerson) {
        this.options.onSelectPerson(personId, fromUserNav);
      }
    } else if (!this.selectedPersonId) {
      // Default to root person
      const def = this.graphStore.findDefaultRootPerson();
      if (def) {
        this.selectPerson(def.id, false, false);
      }
    }
  }

  selectPerson(personId, openModal = true, pushHistory = true) {
    if (!this.graphStore.getPerson(personId)) return;

    this.selectedPersonId = personId;

    if (pushHistory) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      params.set('person', personId);
      if (this.viewMode) params.set('view', this.viewMode);
      window.location.hash = params.toString();
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
    window.location.hash = params.toString();

    if (this.options.onViewModeChange) {
      this.options.onViewModeChange(mode);
    }
  }

  /**
   * Binds the "Focus on Person" search input and dropdown.
   * Handles real-time search and automatic navigation on unique match.
   * @param {HTMLInputElement} inputEl
   * @param {HTMLElement} resultsContainerEl
   */
  bindFocusPersonInput(inputEl, resultsContainerEl) {
    if (!inputEl || !resultsContainerEl) return;

    let debounceTimer = null;

    const performSearch = () => {
      const query = inputEl.value.trim();
      clearChildren(resultsContainerEl);

      if (!query) {
        resultsContainerEl.classList.remove('active');
        return;
      }

      const matches = this.graphStore.searchPeople(query);

      // Section 5.2 / Section 6.1: Automatic Navigation on Unique Match
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
      for (const p of matches.slice(0, 10)) {
        const name = this.graphStore.getDisplayName(p);
        const birthYear = this.graphStore.getBirthYear(p);
        const deathYear = this.graphStore.getDeathYear(p);
        let yearSpan = '';
        if (birthYear || deathYear) {
          yearSpan = ` (${birthYear || '?'} – ${p.living ? 'Levende' : (deathYear || '?')})`;
        }

        const li = createHTML('li', {
          className: 'search-result-item',
          role: 'button',
          tabindex: '0'
        }, [
          createHTML('span', { className: 'result-name', textContent: name }),
          createHTML('span', { className: 'result-dates', textContent: yearSpan })
        ]);

        li.addEventListener('click', () => {
          inputEl.value = name;
          resultsContainerEl.classList.remove('active');
          this.selectPerson(p.id, true);
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
      if (inputEl.value.trim()) {
        performSearch();
      }
    });

    document.addEventListener('click', (e) => {
      if (!inputEl.contains(e.target) && !resultsContainerEl.contains(e.target)) {
        resultsContainerEl.classList.remove('active');
      }
    });

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        resultsContainerEl.classList.remove('active');
      }
    });
  }
}
