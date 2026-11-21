// dom.js - DOM and SVG creation utilities

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Creates an SVG element with attributes and optional children.
 * @param {string} tag
 * @param {Object} [attrs={}]
 * @param {Array<Element|string>} [children=[]]
 * @returns {SVGElement}
 */
export function createSVG(tag, attrs = {}, children = []) {
  const elem = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) {
      if (key.startsWith('on') && typeof value === 'function') {
        elem.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        elem.setAttribute(key, String(value));
      }
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      elem.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      elem.appendChild(child);
    }
  }
  return elem;
}

/**
 * Creates an HTML element with attributes and optional children.
 * @param {string} tag
 * @param {Object} [attrs={}]
 * @param {Array<Element|string>} [children=[]]
 * @returns {HTMLElement}
 */
export function createHTML(tag, attrs = {}, children = []) {
  const elem = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) {
      if (key === 'className') {
        elem.className = value;
      } else if (key === 'innerHTML') {
        elem.innerHTML = value;
      } else if (key === 'textContent') {
        elem.textContent = value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        elem.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        elem.setAttribute(key, String(value));
      }
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      elem.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      elem.appendChild(child);
    }
  }
  return elem;
}

/**
 * Clears all children of an element.
 * @param {Element} el
 */
export function clearChildren(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Truncates string to a max length appending ellipsis if needed.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
export function truncate(str, maxLen = 26) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}
