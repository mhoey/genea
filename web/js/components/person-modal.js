// person-modal.js - HTML5 <dialog> controller for person details inspection

import { clearChildren, createHTML } from '../utils/dom.js';
import { formatGeneaDate } from '../utils/date-format.js';

export class PersonModal {
  /**
   * @param {HTMLElement} dialogElement - The <dialog id="person-dialog"> element
   * @param {GraphStore} graphStore
   * @param {Object} options
   * @param {Function} options.onNavigate - Callback when navigating to a relative: (personId) => void
   * @param {Function} options.onCenterTree - Callback when clicking "Center in Tree": (personId) => void
   */
  constructor(dialogElement, graphStore, options = {}) {
    this.dialog = dialogElement;
    this.graphStore = graphStore;
    this.options = options;
    this.currentPersonId = null;

    this._bindEvents();
  }

  _bindEvents() {
    // Close button
    const closeBtn = this.dialog.querySelector('.modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const secondaryCloseBtn = this.dialog.querySelector('#btn-close-modal');
    if (secondaryCloseBtn) {
      secondaryCloseBtn.addEventListener('click', () => this.close());
    }

    // Center in tree button
    const centerBtn = this.dialog.querySelector('#btn-center-tree');
    if (centerBtn) {
      centerBtn.addEventListener('click', () => {
        if (this.currentPersonId && this.options.onCenterTree) {
          this.options.onCenterTree(this.currentPersonId);
        }
      });
    }

    // Close on backdrop click
    this.dialog.addEventListener('click', (e) => {
      const rect = this.dialog.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        this.close();
      }
    });

    // Close on escape key
    this.dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  /**
   * Opens the modal for the given person ID.
   * @param {string} personId
   */
  open(personId) {
    const person = this.graphStore.getPerson(personId);
    if (!person) return;

    this.currentPersonId = personId;
    this._populate(person);

    if (typeof this.dialog.showModal === 'function') {
      if (!this.dialog.open) {
        this.dialog.showModal();
      }
    } else {
      this.dialog.setAttribute('open', '');
    }
  }

  /**
   * Closes the modal dialog.
   */
  close() {
    if (typeof this.dialog.close === 'function') {
      if (this.dialog.open) {
        this.dialog.close();
      }
    } else {
      this.dialog.removeAttribute('open');
    }
  }

  _populate(person) {
    const displayName = this.graphStore.getDisplayName(person);

    // 1. Header Title & Badges
    const nameEl = this.dialog.querySelector('#modal-person-name');
    if (nameEl) nameEl.textContent = displayName;

    const badgesContainer = this.dialog.querySelector('#modal-badges-container');
    if (badgesContainer) {
      clearChildren(badgesContainer);
      const sex = person.sex || 'unknown';
      const sexBadge = createHTML('span', {
        className: `badge sex-${sex}`,
        textContent: sex.charAt(0).toUpperCase() + sex.slice(1)
      });
      badgesContainer.appendChild(sexBadge);

      const status = person.living ? 'living' : 'deceased';
      const statusBadge = createHTML('span', {
        className: `badge status-${status}`,
        textContent: status.charAt(0).toUpperCase() + status.slice(1)
      });
      badgesContainer.appendChild(statusBadge);
    }

    // 2. Demographics Table
    const demoTable = this.dialog.querySelector('#modal-demographics-table');
    if (demoTable) {
      clearChildren(demoTable);
      const rows = [
        ['ID', person.id]
      ];

      const primaryName = (person.names || [])[0] || {};
      if (primaryName.given) rows.push(['Given Name', primaryName.given]);
      if (primaryName.surname) rows.push(['Surname', primaryName.surname]);
      if (primaryName.maidenOrBirthSurname) rows.push(['Birth Surname', primaryName.maidenOrBirthSurname]);
      if (primaryName.suffix) rows.push(['Suffix', primaryName.suffix]);
      if (displayName) rows.push(['Display Name', displayName]);

      for (const [label, val] of rows) {
        const tr = createHTML('tr', {}, [
          createHTML('th', { textContent: label }),
          createHTML('td', { textContent: val })
        ]);
        demoTable.appendChild(tr);
      }
    }

    // 3. Life Events Timeline
    const timelineEl = this.dialog.querySelector('#modal-events-timeline');
    if (timelineEl) {
      clearChildren(timelineEl);
      const events = person.events || [];

      if (events.length === 0) {
        timelineEl.appendChild(createHTML('li', {
          className: 'event-item empty-state',
          textContent: 'No recorded life events.'
        }));
      } else {
        for (const ev of events) {
          const typeStr = ev.label || (ev.type ? ev.type.charAt(0).toUpperCase() + ev.type.slice(1) : 'Event');
          const dateStr = formatGeneaDate(ev.date, { showExactQualifier: true }) || 'Date unknown';
          const placeStr = ev.place ? (ev.place.country ? `${ev.place.name}, ${ev.place.country}` : ev.place.name) : '';

          const itemChildren = [
            createHTML('span', { className: 'event-type', textContent: typeStr }),
            createHTML('span', { className: 'event-date', textContent: dateStr })
          ];

          if (placeStr) {
            itemChildren.push(createHTML('span', { className: 'event-place', textContent: placeStr }));
          }

          if (ev.description) {
            itemChildren.push(createHTML('div', { className: 'event-desc', textContent: ev.description }));
          }

          if (ev.sourceIds && ev.sourceIds.length > 0) {
            const srcList = createHTML('div', { className: 'event-sources' });
            for (const sId of ev.sourceIds) {
              const src = this.graphStore.getSource(sId);
              const title = src ? src.title : sId;
              srcList.appendChild(createHTML('span', {
                className: 'badge badge-source',
                textContent: `Source: ${title}`
              }));
            }
            itemChildren.push(srcList);
          }

          const li = createHTML('li', { className: `event-item event-${ev.type || 'generic'}` }, itemChildren);
          timelineEl.appendChild(li);
        }
      }
    }

    // 4. Family Relationships
    this._populateRelatives('#modal-parents-list', this.graphStore.getParents(person.id));

    // Spouses
    const spouses = this.graphStore.getSpouses(person.id);
    this._populateSpouses('#modal-spouses-list', spouses);

    // Children
    const children = this.graphStore.getChildren(person.id);
    this._populateChildren('#modal-children-list', children);

    // 5. Notes & Sources
    const notesEl = this.dialog.querySelector('#modal-notes');
    if (notesEl) {
      notesEl.textContent = person.notes || 'No general biographical notes.';
    }

    const sourcesListEl = this.dialog.querySelector('#modal-sources-list');
    if (sourcesListEl) {
      clearChildren(sourcesListEl);
      // Collect sources from all events
      const sourceIds = new Set();
      for (const ev of (person.events || [])) {
        for (const sId of (ev.sourceIds || [])) {
          sourceIds.add(sId);
        }
      }

      if (sourceIds.size === 0) {
        sourcesListEl.appendChild(createHTML('li', {
          className: 'empty-state',
          textContent: 'No sources cited directly for this record.'
        }));
      } else {
        for (const sId of sourceIds) {
          const src = this.graphStore.getSource(sId);
          if (src) {
            const li = createHTML('li', { className: 'source-item' }, [
              createHTML('strong', { textContent: src.title }),
              src.citation ? createHTML('div', { className: 'source-citation', textContent: src.citation }) : null,
              src.repository ? createHTML('div', { className: 'source-repo', textContent: `Repository: ${src.repository}` }) : null,
              src.url ? createHTML('a', {
                href: src.url,
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'source-link',
                textContent: 'External Resource ↗'
              }) : null
            ].filter(Boolean));
            sourcesListEl.appendChild(li);
          } else {
            sourcesListEl.appendChild(createHTML('li', { textContent: sId }));
          }
        }
      }
    }
  }

  _populateRelatives(selector, relatives) {
    const listEl = this.dialog.querySelector(selector);
    if (!listEl) return;
    clearChildren(listEl);

    if (relatives.length === 0) {
      listEl.appendChild(createHTML('li', { className: 'empty-text', textContent: 'None recorded' }));
      return;
    }

    for (const rel of relatives) {
      const name = this.graphStore.getDisplayName(rel);
      const btn = createHTML('button', {
        className: 'link-person',
        'data-id': rel.id,
        textContent: name,
        onClick: (e) => {
          e.preventDefault();
          this._navigate(rel.id);
        }
      });
      listEl.appendChild(createHTML('li', {}, [btn]));
    }
  }

  _populateSpouses(selector, spouses) {
    const listEl = this.dialog.querySelector(selector);
    if (!listEl) return;
    clearChildren(listEl);

    if (spouses.length === 0) {
      listEl.appendChild(createHTML('li', { className: 'empty-text', textContent: 'None recorded' }));
      return;
    }

    for (const item of spouses) {
      const sp = item.person;
      const name = this.graphStore.getDisplayName(sp);
      let marriageDetails = '';
      if (item.marriageEvent && item.marriageEvent.date) {
        marriageDetails = ` (m. ${formatGeneaDate(item.marriageEvent.date)})`;
      }

      const btn = createHTML('button', {
        className: 'link-person',
        'data-id': sp.id,
        textContent: `${name}${marriageDetails}`,
        onClick: (e) => {
          e.preventDefault();
          this._navigate(sp.id);
        }
      });
      listEl.appendChild(createHTML('li', {}, [btn]));
    }
  }

  _populateChildren(selector, children) {
    const listEl = this.dialog.querySelector(selector);
    if (!listEl) return;
    clearChildren(listEl);

    if (children.length === 0) {
      listEl.appendChild(createHTML('li', { className: 'empty-text', textContent: 'None recorded' }));
      return;
    }

    for (const item of children) {
      const ch = item.person;
      const name = this.graphStore.getDisplayName(ch);
      const relKind = item.relationship && item.relationship !== 'biological' ? ` [${item.relationship}]` : '';

      const btn = createHTML('button', {
        className: 'link-person',
        'data-id': ch.id,
        textContent: `${name}${relKind}`,
        onClick: (e) => {
          e.preventDefault();
          this._navigate(ch.id);
        }
      });
      listEl.appendChild(createHTML('li', {}, [btn]));
    }
  }

  _navigate(personId) {
    this.open(personId);
    if (this.options.onNavigate) {
      this.options.onNavigate(personId);
    }
  }
}
