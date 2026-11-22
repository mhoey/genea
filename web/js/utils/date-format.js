// date-format.js - Formatting utilities for GeneaDate and LifeEvents

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

/**
 * Formats a GeneaDate object into a user-friendly string.
 * @param {Object} date - GeneaDate object ({ qualifier, year, month, day, endYear, raw })
 * @param {Object} [options] - Formatting options
 * @param {boolean} [options.showExactQualifier=false] - Whether to append "(exact)"
 * @returns {string} Formatted date string
 */
export function formatGeneaDate(date, options = {}) {
  if (!date) return '';

  let datePart = '';
  if (date.year) {
    if (date.month && date.month >= 1 && date.month <= 12) {
      const monthStr = MONTHS[date.month - 1];
      if (date.day && date.day >= 1 && date.day <= 31) {
        const dayStr = String(date.day).padStart(2, '0');
        datePart = `${dayStr} ${monthStr} ${date.year}`;
      } else {
        datePart = `${monthStr} ${date.year}`;
      }
    } else {
      datePart = String(date.year);
    }
  } else if (date.raw) {
    datePart = date.raw;
  }

  if (!datePart) return '';

  const qualifier = date.qualifier || 'exact';
  switch (qualifier) {
    case 'about':
      return `ca. ${datePart}`;
    case 'before':
      return `før ${datePart}`;
    case 'after':
      return `efter ${datePart}`;
    case 'between':
      if (date.endYear) {
        return `ml. ${datePart} – ${date.endYear}`;
      }
      return `ml. ${datePart}`;
    case 'exact':
    default:
      if (options.showExactQualifier) {
        return `${datePart} (nøjagtig)`;
      }
      return datePart;
  }
}

/**
 * Returns formatted birth string for a node card.
 * @param {Object} person
 * @returns {string} e.g. "* 16 Sep 1892 (Snorom kro)"
 */
export function formatNodeBirth(person) {
  const birthEvent = (person.events || []).find(e => e.type === 'birth');
  if (!birthEvent) {
    return '* Ukendt';
  }

  const dateStr = formatGeneaDate(birthEvent.date);
  const placeName = birthEvent.place?.name;

  if (dateStr && placeName) {
    return `* ${dateStr} (${placeName})`;
  } else if (dateStr) {
    return `* ${dateStr}`;
  } else if (placeName) {
    return `* (${placeName})`;
  }
  return '* Ukendt';
}

/**
 * Returns formatted death/living string for a node card.
 * @param {Object} person
 * @returns {string} e.g. "† 06 Mar 1980 (Århus)" or "Levende"
 */
export function formatNodeDeath(person) {
  if (person.living) {
    return 'Levende';
  }

  const deathEvent = (person.events || []).find(e => e.type === 'death');
  if (!deathEvent) {
    return '† Død';
  }

  const dateStr = formatGeneaDate(deathEvent.date);
  const placeName = deathEvent.place?.name;

  if (dateStr && placeName) {
    return `† ${dateStr} (${placeName})`;
  } else if (dateStr) {
    return `† ${dateStr}`;
  } else if (placeName) {
    return `† (${placeName})`;
  }
  return '† Død';
}
