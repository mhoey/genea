// node-card.js - SVG node card renderer for individuals in the tree

import { createSVG, truncate } from '../utils/dom.js';
import { formatNodeBirth, formatNodeDeath } from '../utils/date-format.js';

const GENDER_COLORS = {
  male: '#3b82f6',     // steel blue
  female: '#ec4899',   // terracotta/rose
  intersex: '#8b5cf6', // purple
  unknown: '#64748b'   // slate
};

const GENDER_SYMBOLS = {
  male: '♂',
  female: '♀',
  intersex: '⚥',
  unknown: '?'
};

/**
 * Creates an SVG <g> element representing a person card in the tree.
 * @param {Object} node - Node layout object { id, person, x, y, width, height }
 * @param {GraphStore} graphStore
 * @param {Object} [options]
 * @param {boolean} [options.isSelected=false]
 * @param {Function} [options.onSelect]
 * @returns {SVGElement}
 */
export function renderNodeCard(node, graphStore, options = {}) {
  const { person, x, y, width, height } = node;
  const isSelected = options.isSelected || false;

  const gender = person.gender || person.sex || 'unknown';
  const accentColor = GENDER_COLORS[gender] || GENDER_COLORS.unknown;
  const genderSymbol = GENDER_SYMBOLS[gender] || '';

  const displayName = graphStore.getDisplayName(person);
  const birthStr = formatNodeBirth(person);
  const deathStr = formatNodeDeath(person);

  const group = createSVG('g', {
    class: `node-card ${isSelected ? 'selected' : ''}`,
    'data-person-id': person.id,
    transform: `translate(${x}, ${y})`,
    role: 'button',
    tabindex: '0',
    'aria-label': `${displayName}, ${birthStr}, ${deathStr}`
  });

  // Background card rectangle
  const bgRect = createSVG('rect', {
    class: 'node-rect',
    x: 0,
    y: 0,
    width,
    height,
    rx: 8,
    ry: 8
  });
  group.appendChild(bgRect);

  // Left gender accent bar
  const accentBar = createSVG('rect', {
    class: 'node-accent-bar',
    x: 0,
    y: 0,
    width: 6,
    height,
    rx: 4,
    ry: 4,
    fill: accentColor
  });
  group.appendChild(accentBar);

  // Name text
  const nameText = createSVG('text', {
    class: 'node-name',
    x: 16,
    y: 26
  }, [truncate(displayName, 24)]);
  group.appendChild(nameText);

  // Gender icon badge
  if (genderSymbol) {
    const genderText = createSVG('text', {
      class: 'node-gender-badge',
      x: width - 16,
      y: 26,
      'text-anchor': 'end',
      fill: accentColor
    }, [genderSymbol]);
    group.appendChild(genderText);
  }

  // Divider line
  const divider = createSVG('line', {
    class: 'node-divider',
    x1: 16,
    y1: 36,
    x2: width - 16,
    y2: 36
  });
  group.appendChild(divider);

  // Birth date & place
  const birthText = createSVG('text', {
    class: 'node-date node-birth',
    x: 16,
    y: 52
  }, [truncate(birthStr, 28)]);
  group.appendChild(birthText);

  // Death date / living status
  const deathText = createSVG('text', {
    class: `node-date node-death ${person.living ? 'living' : ''}`,
    x: 16,
    y: 70
  }, [truncate(deathStr, 28)]);
  group.appendChild(deathText);

  // Interaction handlers
  if (options.onSelect) {
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      options.onSelect(person.id);
    });

    group.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        options.onSelect(person.id);
      }
    });
  }

  return group;
}
