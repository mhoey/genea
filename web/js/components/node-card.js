// node-card.js - SVG node card renderer for individuals in the tree

import { createSVG, truncate } from '../utils/dom.js';
import { formatNodeBirth, formatNodeDeath } from '../utils/date-format.js';

const GENDER_COLORS = {
  male: '#5b7c99',     // subdued dusty slate-blue
  female: '#a66a6a',   // subdued muted terracotta-rose
  intersex: '#7e6b8f', // subdued dusty mauve
  unknown: '#7d6e61'   // subdued warm taupe
};

const GENDER_BG_COLORS = {
  male: '#ebf0f5',
  female: '#f5ebeb',
  intersex: '#f0ebf5',
  unknown: '#efeae4'
};

const GENDER_SYMBOLS = {
  male: '♂',
  female: '♀',
  intersex: '⚥',
  unknown: '?'
};

/**
 * Splits a full display name into 1 or 2 balanced lines at word boundaries
 * so that even 46-character names never get cut off with ellipses.
 * @param {string} name
 * @param {number} maxSingleLine
 * @returns {string[]}
 */
function wrapNameLines(name, maxSingleLine = 28) {
  const clean = (name || '').trim();
  if (clean.length <= maxSingleLine) {
    return [clean];
  }

  const words = clean.split(/\s+/);
  if (words.length <= 1) {
    return [clean];
  }

  // Find split point closest to the middle while keeping line 1 <= maxSingleLine (due to gender badge on top-right)
  let bestSplit = 1;
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(' ');
    const l2 = words.slice(i).join(' ');
    const penalty = l1.length > maxSingleLine ? (l1.length - maxSingleLine) * 4 : 0;
    const score = Math.abs(l1.length - l2.length) + penalty;
    if (score < bestScore) {
      bestScore = score;
      bestSplit = i;
    }
  }

  return [
    words.slice(0, bestSplit).join(' '),
    words.slice(bestSplit).join(' ')
  ];
}

/**
 * Splits a full display name into 2 balanced lines for zoomed-out overview legibility.
 * @param {string} name
 * @returns {string[]}
 */
function wrapOverviewLines(name) {
  const clean = (name || '').trim();
  const words = clean.split(/\s+/);
  if (words.length <= 1) {
    return [clean];
  }
  let bestSplit = Math.max(1, words.length - 1);
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(' ');
    const l2 = words.slice(i).join(' ');
    const diff = Math.abs(l1.length - l2.length);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSplit = i;
    }
  }
  return [
    words.slice(0, bestSplit).join(' '),
    words.slice(bestSplit).join(' ')
  ];
}

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
  const badgeBgColor = GENDER_BG_COLORS[gender] || GENDER_BG_COLORS.unknown;
  const genderSymbol = GENDER_SYMBOLS[gender] || '';

  const displayName = graphStore.getDisplayName(person);
  const birthStr = formatNodeBirth(person);
  const deathStr = formatNodeDeath(person);

  const nameLines = wrapNameLines(displayName, 28);
  const isTwoLine = nameLines.length > 1;

  const group = createSVG('g', {
    class: `node-card node-gender-${gender} ${isSelected ? 'selected' : ''} ${isTwoLine ? 'node-two-line' : ''}`,
    'data-person-id': person.id,
    transform: `translate(${x}, ${y})`,
    role: 'button',
    tabindex: '0',
    'aria-label': `${displayName}, ${birthStr}, ${deathStr}`
  });

  // Full name tooltip on hover
  const titleEl = createSVG('title', {}, [`${displayName}\n${birthStr}\n${deathStr}`]);
  group.appendChild(titleEl);

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
    width: 5,
    height,
    rx: 4,
    ry: 4,
    fill: accentColor
  });
  group.appendChild(accentBar);

  // Normal/Detail Zoom Name Text (1 or 2 full lines, never truncated)
  if (!isTwoLine) {
    const nameAttrs = {
      class: 'node-name',
      x: 16,
      y: 26
    };
    if (nameLines[0].length > 29) {
      nameAttrs.textLength = width - 50;
      nameAttrs.lengthAdjust = 'spacingAndGlyphs';
    }
    const nameText = createSVG('text', nameAttrs, [nameLines[0]]);
    group.appendChild(nameText);
  } else {
    const line1Attrs = {
      class: 'node-name node-name-line1',
      x: 16,
      y: 19
    };
    if (nameLines[0].length > 28) {
      line1Attrs.textLength = width - 50;
      line1Attrs.lengthAdjust = 'spacingAndGlyphs';
    }
    group.appendChild(createSVG('text', line1Attrs, [nameLines[0]]));

    const line2Attrs = {
      class: 'node-name node-name-line2',
      x: 16,
      y: 35
    };
    if (nameLines[1].length > 32) {
      line2Attrs.textLength = width - 28;
      line2Attrs.lengthAdjust = 'spacingAndGlyphs';
    }
    group.appendChild(createSVG('text', line2Attrs, [nameLines[1]]));
  }

  // Overview Zoom Large 2-Line Name (visible when zoomed out < 45%)
  const ovLines = wrapOverviewLines(displayName);
  const ovGroup = createSVG('g', { class: 'node-overview-group' });
  if (ovLines.length === 1) {
    const ovAttrs = {
      class: 'node-overview-name',
      x: 16,
      y: 52
    };
    if (ovLines[0].length > 20) {
      ovAttrs.textLength = width - 48;
      ovAttrs.lengthAdjust = 'spacingAndGlyphs';
    }
    ovGroup.appendChild(createSVG('text', ovAttrs, [ovLines[0]]));
  } else {
    const ov1Attrs = {
      class: 'node-overview-name node-overview-line1',
      x: 16,
      y: 38
    };
    if (ovLines[0].length > 20) {
      ov1Attrs.textLength = width - 50;
      ov1Attrs.lengthAdjust = 'spacingAndGlyphs';
    }
    ovGroup.appendChild(createSVG('text', ov1Attrs, [ovLines[0]]));

    const ov2Attrs = {
      class: 'node-overview-name node-overview-line2',
      x: 16,
      y: 66
    };
    if (ovLines[1].length > 21) {
      ov2Attrs.textLength = width - 30;
      ov2Attrs.lengthAdjust = 'spacingAndGlyphs';
    }
    ovGroup.appendChild(createSVG('text', ov2Attrs, [ovLines[1]]));
  }
  group.appendChild(ovGroup);

  // High-contrast Gender icon badge pill
  if (genderSymbol) {
    const badgeCx = width - 19;
    const badgeCy = 19;
    const genderBg = createSVG('circle', {
      class: 'node-gender-pill',
      cx: badgeCx,
      cy: badgeCy,
      r: 10,
      fill: badgeBgColor,
      stroke: accentColor,
      'stroke-width': 1.25
    });
    group.appendChild(genderBg);

    const genderText = createSVG('text', {
      class: 'node-gender-badge',
      x: badgeCx,
      y: badgeCy + 4.5,
      'text-anchor': 'middle',
      fill: accentColor
    }, [genderSymbol]);
    group.appendChild(genderText);
  }

  // Divider line
  const dividerY = isTwoLine ? 43 : 38;
  const divider = createSVG('line', {
    class: 'node-divider',
    x1: 16,
    y1: dividerY,
    x2: width - 16,
    y2: dividerY
  });
  group.appendChild(divider);

  // Birth date & place
  const birthText = createSVG('text', {
    class: 'node-date node-birth',
    x: 16,
    y: isTwoLine ? 60 : 56
  }, [truncate(birthStr, 36)]);
  group.appendChild(birthText);

  // Death date / living status
  const deathText = createSVG('text', {
    class: `node-date node-death ${person.living ? 'living' : ''}`,
    x: 16,
    y: isTwoLine ? 78 : 75
  }, [truncate(deathStr, 36)]);
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
