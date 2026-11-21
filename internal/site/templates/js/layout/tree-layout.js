// tree-layout.js - Genealogical DAG layout engine for Hourglass and Full Network views

import { createCurvedConnector, createHorizontalConnector } from './bezier.js';

export const CARD_WIDTH = 220;
export const CARD_HEIGHT = 84;
export const TIER_GAP = 140;
export const TIER_HEIGHT = CARD_HEIGHT + TIER_GAP; // 224px
export const NODE_SPACING_X = 32;
export const CLUSTER_SPACING_X = 64;

/**
 * Calculates a full generational network layout containing all people and families.
 * @param {GraphStore} graphStore
 * @returns {Object} Layout result { nodes, families, edges, bounds }
 */
export function layoutAll(graphStore) {
  const people = graphStore.getAllPeople();
  const families = graphStore.getAllFamilies();

  if (people.length === 0) {
    return { nodes: [], families: [], edges: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 } };
  }

  // 1. Calculate generational ranks for all people
  const genMap = new Map();
  for (const p of people) {
    genMap.set(p.id, 0);
  }

  // Iterative relaxation to establish generational hierarchy
  for (let iter = 0; iter < 40; iter++) {
    let changed = false;

    // Children must be at least 1 generation below both parents
    for (const f of families) {
      let maxParentGen = 0;
      for (const pId of (f.partnerIds || [])) {
        const pGen = genMap.get(pId) || 0;
        if (pGen > maxParentGen) maxParentGen = pGen;
      }

      // Spouses should ideally share the same generational tier
      for (const pId of (f.partnerIds || [])) {
        if (genMap.get(pId) < maxParentGen) {
          genMap.set(pId, maxParentGen);
          changed = true;
        }
      }

      // Children are placed in maxParentGen + 1
      for (const childLink of (f.children || [])) {
        const childGen = genMap.get(childLink.personId) || 0;
        if (childGen <= maxParentGen) {
          genMap.set(childLink.personId, maxParentGen + 1);
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  // Group individuals by generation
  const tiers = new Map();
  for (const p of people) {
    const gen = genMap.get(p.id) || 0;
    if (!tiers.has(gen)) {
      tiers.set(gen, []);
    }
    tiers.get(gen).push(p);
  }

  const sortedGens = Array.from(tiers.keys()).sort((a, b) => a - b);

  // Map to store calculated node positions
  const nodeMap = new Map();
  const familyAnchorMap = new Map();
  const nodes = [];
  const familyNodes = [];
  const edges = [];

  // 2. Position nodes across tiers
  // To avoid spaghetti, we cluster family partners together on each tier
  for (const gen of sortedGens) {
    const tierPeople = tiers.get(gen);
    const y = gen * TIER_HEIGHT;

    // Sort people in this tier: cluster families together
    const processedPeople = new Set();
    const orderedUnits = [];

    for (const p of tierPeople) {
      if (processedPeople.has(p.id)) continue;

      // Check if person has spouses in this tier
      const spouses = graphStore.getSpouses(p.id)
        .filter(s => tierPeople.some(tp => tp.id === s.person.id) && !processedPeople.has(s.person.id));

      if (spouses.length > 0) {
        const unit = [p];
        processedPeople.add(p.id);
        for (const s of spouses) {
          unit.push(s.person);
          processedPeople.add(s.person.id);
        }
        orderedUnits.push(unit);
      } else {
        processedPeople.add(p.id);
        orderedUnits.push([p]);
      }
    }

    // Place units horizontally across the tier
    let currentX = 0;
    for (let uIdx = 0; uIdx < orderedUnits.length; uIdx++) {
      const unit = orderedUnits[uIdx];

      for (let pIdx = 0; pIdx < unit.length; pIdx++) {
        const person = unit[pIdx];
        const x = currentX;
        const nodeObj = {
          id: person.id,
          person,
          x,
          y,
          width: CARD_WIDTH,
          height: CARD_HEIGHT
        };
        nodeMap.set(person.id, nodeObj);
        nodes.push(nodeObj);

        currentX += CARD_WIDTH + NODE_SPACING_X;
      }

      currentX += CLUSTER_SPACING_X;
    }
  }

  // 3. Compute family anchors and edges
  for (const f of families) {
    const partnerNodes = (f.partnerIds || [])
      .map(id => nodeMap.get(id))
      .filter(Boolean);

    let anchorX = 0;
    let anchorY = 0;

    if (partnerNodes.length === 2) {
      // Anchor between partners
      const leftNode = partnerNodes[0].x < partnerNodes[1].x ? partnerNodes[0] : partnerNodes[1];
      const rightNode = partnerNodes[0].x < partnerNodes[1].x ? partnerNodes[1] : partnerNodes[0];

      anchorX = (leftNode.x + CARD_WIDTH + rightNode.x) / 2;
      anchorY = leftNode.y + CARD_HEIGHT / 2;

      // Marriage edge connecting partners
      edges.push({
        id: `edge_m_${f.id}`,
        type: 'marriage',
        fromId: leftNode.id,
        toId: rightNode.id,
        d: createHorizontalConnector(leftNode.x + CARD_WIDTH, anchorY, rightNode.x)
      });
    } else if (partnerNodes.length === 1) {
      // Single parent family
      anchorX = partnerNodes[0].x + CARD_WIDTH / 2;
      anchorY = partnerNodes[0].y + CARD_HEIGHT;
    } else {
      // No positioned partners
      continue;
    }

    const famAnchor = {
      id: f.id,
      family: f,
      x: anchorX,
      y: anchorY
    };
    familyAnchorMap.set(f.id, famAnchor);
    familyNodes.push(famAnchor);

    // Edges to children
    for (const childLink of (f.children || [])) {
      const childNode = nodeMap.get(childLink.personId);
      if (childNode) {
        const startX = anchorX;
        const startY = anchorY;
        const targetX = childNode.x + CARD_WIDTH / 2;
        const targetY = childNode.y;

        edges.push({
          id: `edge_c_${f.id}_${childNode.id}`,
          type: 'child',
          fromId: f.id,
          toId: childNode.id,
          d: createCurvedConnector(startX, startY, targetX, targetY)
        });
      }
    }
  }

  // Calculate bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }

  if (minX === Infinity) {
    minX = 0;
    minY = 0;
    maxX = 800;
    maxY = 600;
  }

  return {
    nodes,
    families: familyNodes,
    edges,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    }
  };
}

/**
 * Calculates an Hourglass lineage layout centered on a specific focus person.
 * Ancestors expand upwards, descendants expand downwards, spouses sit beside the focus person.
 * @param {GraphStore} graphStore
 * @param {string} focusPersonId
 * @returns {Object} Layout result { nodes, families, edges, bounds }
 */
export function layoutHourglass(graphStore, focusPersonId) {
  const rootPerson = graphStore.getPerson(focusPersonId) || graphStore.findDefaultRootPerson();
  if (!rootPerson) {
    return layoutAll(graphStore);
  }

  const nodes = [];
  const familyNodes = [];
  const edges = [];
  const nodeMap = new Map();

  // Helper to add node
  function addNode(person, x, y) {
    if (nodeMap.has(person.id)) return nodeMap.get(person.id);
    const nodeObj = {
      id: person.id,
      person,
      x,
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT
    };
    nodeMap.set(person.id, nodeObj);
    nodes.push(nodeObj);
    return nodeObj;
  }

  // 1. Center Tier (Gen 0): Focus Person and Spouses
  const spouses = graphStore.getSpouses(rootPerson.id);
  const centerPeople = [rootPerson, ...spouses.map(s => s.person)];

  let startX = -(centerPeople.length * (CARD_WIDTH + NODE_SPACING_X)) / 2;
  for (let i = 0; i < centerPeople.length; i++) {
    addNode(centerPeople[i], startX + i * (CARD_WIDTH + NODE_SPACING_X), 0);
  }

  // 2. Ancestors (Generations -1, -2, -3, ...)
  function buildAncestors(childPerson, childNode, currentGen) {
    if (Math.abs(currentGen) > 4) return; // Limit depth for readability

    const parents = graphStore.getParents(childPerson.id);
    if (parents.length === 0) return;

    const parentY = currentGen * TIER_HEIGHT;
    const parentNodes = [];

    // Place parents centered above the child
    const parentClusterWidth = parents.length * CARD_WIDTH + (parents.length - 1) * NODE_SPACING_X;
    let pStartX = (childNode.x + CARD_WIDTH / 2) - parentClusterWidth / 2;

    for (let i = 0; i < parents.length; i++) {
      const p = parents[i];
      const pNode = addNode(p, pStartX + i * (CARD_WIDTH + NODE_SPACING_X), parentY);
      parentNodes.push(pNode);
      buildAncestors(p, pNode, currentGen - 1);
    }

    // Connect parents to child
    if (parentNodes.length === 2) {
      const pLeft = parentNodes[0].x < parentNodes[1].x ? parentNodes[0] : parentNodes[1];
      const pRight = parentNodes[0].x < parentNodes[1].x ? parentNodes[1] : parentNodes[0];
      const anchorX = (pLeft.x + CARD_WIDTH + pRight.x) / 2;
      const anchorY = pLeft.y + CARD_HEIGHT / 2;

      edges.push({
        id: `edge_m_anc_${pLeft.id}_${pRight.id}`,
        type: 'marriage',
        fromId: pLeft.id,
        toId: pRight.id,
        d: createHorizontalConnector(pLeft.x + CARD_WIDTH, anchorY, pRight.x)
      });

      edges.push({
        id: `edge_c_anc_${pLeft.id}_${childNode.id}`,
        type: 'child',
        fromId: `${pLeft.id}_${pRight.id}`,
        toId: childNode.id,
        d: createCurvedConnector(anchorX, anchorY, childNode.x + CARD_WIDTH / 2, childNode.y)
      });
    } else if (parentNodes.length === 1) {
      const p = parentNodes[0];
      edges.push({
        id: `edge_c_anc_${p.id}_${childNode.id}`,
        type: 'child',
        fromId: p.id,
        toId: childNode.id,
        d: createCurvedConnector(p.x + CARD_WIDTH / 2, p.y + CARD_HEIGHT, childNode.x + CARD_WIDTH / 2, childNode.y)
      });
    }
  }

  // 3. Descendants (Generations +1, +2, +3, ...)
  function buildDescendants(parentPerson, parentNode, currentGen) {
    if (currentGen > 4) return;

    const childrenLinks = graphStore.getChildren(parentPerson.id);
    if (childrenLinks.length === 0) return;

    const childY = currentGen * TIER_HEIGHT;
    const totalWidth = childrenLinks.length * CARD_WIDTH + (childrenLinks.length - 1) * NODE_SPACING_X;
    let cStartX = (parentNode.x + CARD_WIDTH / 2) - totalWidth / 2;

    for (let i = 0; i < childrenLinks.length; i++) {
      const childLink = childrenLinks[i];
      const childPerson = childLink.person;
      const childNode = addNode(childPerson, cStartX + i * (CARD_WIDTH + NODE_SPACING_X), childY);

      // Edge from parent to child
      edges.push({
        id: `edge_c_desc_${parentPerson.id}_${childPerson.id}`,
        type: 'child',
        fromId: parentPerson.id,
        toId: childPerson.id,
        d: createCurvedConnector(parentNode.x + CARD_WIDTH / 2, parentNode.y + CARD_HEIGHT, childNode.x + CARD_WIDTH / 2, childNode.y)
      });

      buildDescendants(childPerson, childNode, currentGen + 1);
    }
  }

  // Build upwards and downwards from focus person
  const focusNode = nodeMap.get(rootPerson.id);
  buildAncestors(rootPerson, focusNode, -1);
  buildDescendants(rootPerson, focusNode, 1);

  // Calculate bounds
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }

  if (minX === Infinity) {
    minX = -400;
    minY = -300;
    maxX = 400;
    maxY = 300;
  }

  return {
    nodes,
    families: familyNodes,
    edges,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    }
  };
}
