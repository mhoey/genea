// tree-layout.js - Untangled Genealogical DAG layout engine for Network and Hourglass views

import { createCurvedConnector, createHorizontalConnector } from './bezier.js';

export const CARD_WIDTH = 220;
export const CARD_HEIGHT = 84;
export const TIER_GAP = 140;
export const TIER_HEIGHT = CARD_HEIGHT + TIER_GAP; // 224px
export const NODE_SPACING_X = 32;
export const CLUSTER_SPACING_X = 64;

/**
 * Calculates a full generational network layout containing all people and families.
 * Uses bidirectional generational ranking, nuclear family clustering, and
 * two-way Sugiyama barycenter sweeps to eliminate edge crossings and overlapping nodes.
 * @param {GraphStore} graphStore
 * @returns {Object} Layout result { nodes, families, edges, bounds }
 */
export function layoutAll(graphStore) {
  const people = graphStore.getAllPeople();
  const families = graphStore.getAllFamilies();

  if (people.length === 0) {
    return { nodes: [], families: [], edges: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }, panels: [] };
  }

  // 1. Calculate generational ranks for all people using bidirectional propagation
  const genMap = new Map();
  for (const p of people) {
    genMap.set(p.id, 0);
  }

  // Fast lookups
  const familyById = new Map();
  const childToParentFamilyId = new Map();
  const familiesByPartnerId = new Map();

  for (const f of families) {
    familyById.set(f.id, f);
    for (const c of (f.children || [])) {
      childToParentFamilyId.set(c.personId, f.id);
    }
    for (const pId of (f.partnerIds || [])) {
      if (!familiesByPartnerId.has(pId)) familiesByPartnerId.set(pId, []);
      familiesByPartnerId.get(pId).push(f);
    }
  }

  // Iterative bidirectional relaxation to establish true generational hierarchy
  for (let iter = 0; iter < 100; iter++) {
    let changed = false;

    for (const f of families) {
      const partnerIds = f.partnerIds || [];
      const children = f.children || [];

      if (partnerIds.length > 0) {
        // A. Spouses should share the same generational tier
        let maxParentGen = 0;
        for (const pId of partnerIds) {
          const pGen = genMap.get(pId) || 0;
          if (pGen > maxParentGen) maxParentGen = pGen;
        }

        for (const pId of partnerIds) {
          if (genMap.get(pId) < maxParentGen) {
            genMap.set(pId, maxParentGen);
            changed = true;
          }
        }

        // B. Downward constraint: children are placed strictly below both parents
        for (const childLink of children) {
          const childGen = genMap.get(childLink.personId) || 0;
          if (childGen <= maxParentGen) {
            genMap.set(childLink.personId, maxParentGen + 1);
            changed = true;
          }
        }

        // C. Upward constraint: parents must be at least max(children) - 1
        // This ensures in-laws and ancestors are pulled down to their proper chronological generation
        if (children.length > 0) {
          let maxChildGen = 0;
          for (const childLink of children) {
            const childGen = genMap.get(childLink.personId) || 0;
            if (childGen > maxChildGen) maxChildGen = childGen;
          }
          const minParentGen = maxChildGen - 1;
          for (const pId of partnerIds) {
            if (genMap.get(pId) < minParentGen) {
              genMap.set(pId, minParentGen);
              changed = true;
            }
          }
        }
      }
    }

    if (!changed) break;
  }

  // Normalize so the earliest generation is 0
  let minGen = Infinity;
  for (const p of people) {
    const g = genMap.get(p.id) || 0;
    if (g < minGen) minGen = g;
  }
  if (minGen !== Infinity && minGen > 0) {
    for (const p of people) {
      genMap.set(p.id, (genMap.get(p.id) || 0) - minGen);
    }
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

  // 2. Form cohesive layout units per tier (couples, multi-spouse chains, and individuals)
  const tierUnits = new Map();
  for (const gen of sortedGens) {
    const tierPeople = tiers.get(gen);
    const tierPersonSet = new Set(tierPeople.map(p => p.id));
    const processed = new Set();
    const units = [];

    // Build local spouse adjacency graph on this tier
    const localSpouseGraph = new Map();
    for (const p of tierPeople) {
      localSpouseGraph.set(p.id, new Set());
    }
    for (const f of families) {
      const pIds = (f.partnerIds || []).filter(id => tierPersonSet.has(id));
      for (let i = 0; i < pIds.length; i++) {
        for (let j = i + 1; j < pIds.length; j++) {
          localSpouseGraph.get(pIds[i])?.add(pIds[j]);
          localSpouseGraph.get(pIds[j])?.add(pIds[i]);
        }
      }
    }

    for (const p of tierPeople) {
      if (processed.has(p.id)) continue;

      // Extract connected component of spouses
      const component = [];
      const queue = [p.id];
      processed.add(p.id);

      while (queue.length > 0) {
        const curr = queue.shift();
        component.push(curr);
        for (const neighbor of (localSpouseGraph.get(curr) || [])) {
          if (!processed.has(neighbor)) {
            processed.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      // Order component so married partners sit side-by-side
      let orderedPeopleIds = [];
      if (component.length <= 2) {
        orderedPeopleIds = component;
      } else {
        // Find leaf / terminal spouse (degree 1) to start chain
        const endNode = component.find(id => (localSpouseGraph.get(id)?.size || 0) === 1) || component[0];
        const visitedInComp = new Set([endNode]);
        orderedPeopleIds = [endNode];
        let curr = endNode;
        while (curr) {
          const next = Array.from(localSpouseGraph.get(curr) || []).find(id => !visitedInComp.has(id));
          if (next) {
            visitedInComp.add(next);
            orderedPeopleIds.push(next);
            curr = next;
          } else {
            break;
          }
        }
        for (const id of component) {
          if (!visitedInComp.has(id)) orderedPeopleIds.push(id);
        }
      }

      const unitPeople = orderedPeopleIds.map(id => graphStore.getPerson(id)).filter(Boolean);
      const unitWidth = unitPeople.length * CARD_WIDTH + Math.max(0, unitPeople.length - 1) * NODE_SPACING_X;

      units.push({
        people: unitPeople,
        width: unitWidth,
        x: 0,
        barycenter: 0
      });
    }

    tierUnits.set(gen, units);
  }

  // 3. Collision avoidance & compaction: Assign non-overlapping horizontal coordinates
  function assignTierCoordinates(units, spacing) {
    if (!units || units.length === 0) return;

    // Left-to-right pass: place at ideal barycenter without overlapping previous unit
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const idealLeft = u.barycenter - u.width / 2;
      if (i === 0) {
        u.x = idealLeft;
      } else {
        const prev = units[i - 1];
        const minLeft = prev.x + prev.width + spacing;
        u.x = Math.max(minLeft, idealLeft);
      }
    }

    // Right-to-left compaction pass: pull units back towards ideal barycenter when space permits
    for (let i = units.length - 2; i >= 0; i--) {
      const u = units[i];
      const nxt = units[i + 1];
      const idealLeft = u.barycenter - u.width / 2;
      const maxLeft = nxt.x - spacing - u.width;
      const target = Math.min(maxLeft, idealLeft);
      if (target > u.x) {
        u.x = target;
      }
    }
  }

  // Initial placement across tiers
  for (const gen of sortedGens) {
    assignTierCoordinates(tierUnits.get(gen), CLUSTER_SPACING_X);
  }

  // 4. Two-way Sugiyama Barycenter Sweeps for crossing minimization
  const SWEEP_COUNT = 16;
  for (let sweep = 0; sweep < SWEEP_COUNT; sweep++) {
    // A. Downward sweep (Tier 0 to max)
    for (const gen of sortedGens) {
      const units = tierUnits.get(gen) || [];
      const parentUnits = tierUnits.get(gen - 1) || [];

      for (const u of units) {
        const parentXs = [];
        for (const person of u.people) {
          const pfamId = childToParentFamilyId.get(person.id);
          if (pfamId) {
            const pfam = familyById.get(pfamId);
            if (pfam) {
              const partnerXs = [];
              for (const partnerId of (pfam.partnerIds || [])) {
                for (const pu of parentUnits) {
                  const pIdx = pu.people.findIndex(p => p.id === partnerId);
                  if (pIdx !== -1) {
                    partnerXs.push(pu.x + pIdx * (CARD_WIDTH + NODE_SPACING_X) + CARD_WIDTH / 2);
                  }
                }
              }
              if (partnerXs.length > 0) {
                parentXs.push(partnerXs.reduce((a, b) => a + b, 0) / partnerXs.length);
              }
            }
          }
        }

        if (parentXs.length > 0) {
          u.barycenter = parentXs.reduce((a, b) => a + b, 0) / parentXs.length;
        } else if (u.barycenter === 0) {
          u.barycenter = u.x + u.width / 2;
        }
      }

      units.sort((a, b) => a.barycenter - b.barycenter);
      assignTierCoordinates(units, CLUSTER_SPACING_X);
    }

    // B. Upward sweep (Tier max to 0)
    for (let gIdx = sortedGens.length - 1; gIdx >= 0; gIdx--) {
      const gen = sortedGens[gIdx];
      const units = tierUnits.get(gen) || [];
      const childUnits = tierUnits.get(gen + 1) || [];

      for (const u of units) {
        const childXs = [];
        for (const person of u.people) {
          const fams = familiesByPartnerId.get(person.id) || [];
          for (const f of fams) {
            for (const childLink of (f.children || [])) {
              for (const cu of childUnits) {
                const cIdx = cu.people.findIndex(p => p.id === childLink.personId);
                if (cIdx !== -1) {
                  childXs.push(cu.x + cIdx * (CARD_WIDTH + NODE_SPACING_X) + CARD_WIDTH / 2);
                }
              }
            }
          }
        }

        if (childXs.length > 0) {
          u.barycenter = childXs.reduce((a, b) => a + b, 0) / childXs.length;
        } else if (u.barycenter === 0) {
          u.barycenter = u.x + u.width / 2;
        }
      }

      units.sort((a, b) => a.barycenter - b.barycenter);
      assignTierCoordinates(units, CLUSTER_SPACING_X);
    }
  }

  // Normalize all X coordinates so layout starts with a clean left margin
  let globalMinX = Infinity;
  for (const units of tierUnits.values()) {
    for (const u of units) {
      if (u.x < globalMinX) globalMinX = u.x;
    }
  }
  const xOffset = globalMinX !== Infinity ? -globalMinX + 40 : 40;
  for (const units of tierUnits.values()) {
    for (const u of units) {
      u.x += xOffset;
    }
  }

  // 5. Construct layout nodes map
  const nodeMap = new Map();
  const nodes = [];
  const familyAnchorMap = new Map();
  const familyNodes = [];
  const edges = [];

  for (const gen of sortedGens) {
    const units = tierUnits.get(gen) || [];
    const y = gen * TIER_HEIGHT + 40;

    for (const u of units) {
      for (let pIdx = 0; pIdx < u.people.length; pIdx++) {
        const person = u.people[pIdx];
        const x = u.x + pIdx * (CARD_WIDTH + NODE_SPACING_X);
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
      }
    }
  }

  // 6. Compute family anchors and connection edges
  for (const f of families) {
    const partnerNodes = (f.partnerIds || [])
      .map(id => nodeMap.get(id))
      .filter(Boolean);

    let anchorX = 0;
    let anchorY = 0;

    if (partnerNodes.length === 2) {
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

    // Edges to children (smooth S-curve strictly through tier gap)
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

  // 7. Calculate overall layout bounds
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

  // 8. Generate horizontal generation panels
  const panels = [];
  if (sortedGens.length > 0 && nodes.length > 0) {
    const minGen = sortedGens[0];
    const maxGen = sortedGens[sortedGens.length - 1];
    const panelX = minX - 10000;
    const panelWidth = (maxX - minX) + 20000;

    for (let gen = minGen; gen <= maxGen; gen++) {
      const panelY = gen * TIER_HEIGHT + 40 - TIER_GAP / 2;
      panels.push({
        id: `gen_panel_${gen}`,
        generation: gen,
        isEven: Math.abs(gen) % 2 === 0,
        x: panelX,
        y: panelY,
        width: panelWidth,
        height: TIER_HEIGHT
      });
    }
  }

  return {
    nodes,
    families: familyNodes,
    edges,
    bounds: {
      minX,
      minY,
      maxX: maxX + 40,
      maxY: maxY + 40,
      width: (maxX - minX) + 80,
      height: (maxY - minY) + 80
    },
    panels
  };
}

/**
 * Calculates an Hourglass lineage layout centered on a specific focus person.
 * Ancestors expand upwards, descendants expand downwards, spouses sit beside the focus person.
 * Resolves horizontal overlaps so no cards collide.
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
    if (Math.abs(currentGen) > 4) return;

    const parents = graphStore.getParents(childPerson.id);
    if (parents.length === 0) return;

    const parentY = currentGen * TIER_HEIGHT;
    const parentNodes = [];

    const parentClusterWidth = parents.length * CARD_WIDTH + (parents.length - 1) * NODE_SPACING_X;
    let pStartX = (childNode.x + CARD_WIDTH / 2) - parentClusterWidth / 2;

    for (let i = 0; i < parents.length; i++) {
      const p = parents[i];
      const pNode = addNode(p, pStartX + i * (CARD_WIDTH + NODE_SPACING_X), parentY);
      parentNodes.push(pNode);
      buildAncestors(p, pNode, currentGen - 1);
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

      buildDescendants(childPerson, childNode, currentGen + 1);
    }
  }

  const focusNode = nodeMap.get(rootPerson.id);
  buildAncestors(rootPerson, focusNode, -1);
  buildDescendants(rootPerson, focusNode, 1);

  // 4. Overlap Prevention across tiers in Hourglass view
  const tierMap = new Map();
  for (const n of nodes) {
    const gen = Math.round(n.y / TIER_HEIGHT);
    if (!tierMap.has(gen)) tierMap.set(gen, []);
    tierMap.get(gen).push(n);
  }

  for (const [gen, tierNodes] of tierMap.entries()) {
    tierNodes.sort((a, b) => a.x - b.x);
    for (let i = 1; i < tierNodes.length; i++) {
      const prev = tierNodes[i - 1];
      const curr = tierNodes[i];
      const minX = prev.x + prev.width + NODE_SPACING_X;
      if (curr.x < minX) {
        curr.x = minX;
      }
    }
  }

  // 5. Build edges with updated coordinates
  for (const n of nodes) {
    // Parents
    const parents = graphStore.getParents(n.id)
      .map(p => nodeMap.get(p.id))
      .filter(Boolean);

    if (parents.length === 2) {
      const pLeft = parents[0].x < parents[1].x ? parents[0] : parents[1];
      const pRight = parents[0].x < parents[1].x ? parents[1] : parents[0];
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
        id: `edge_c_anc_${pLeft.id}_${n.id}`,
        type: 'child',
        fromId: `${pLeft.id}_${pRight.id}`,
        toId: n.id,
        d: createCurvedConnector(anchorX, anchorY, n.x + CARD_WIDTH / 2, n.y)
      });
    } else if (parents.length === 1) {
      const p = parents[0];
      edges.push({
        id: `edge_c_anc_${p.id}_${n.id}`,
        type: 'child',
        fromId: p.id,
        toId: n.id,
        d: createCurvedConnector(p.x + CARD_WIDTH / 2, p.y + CARD_HEIGHT, n.x + CARD_WIDTH / 2, n.y)
      });
    }

    // Spouses on center tier
    if (n.y === 0) {
      const sps = graphStore.getSpouses(n.id)
        .map(s => nodeMap.get(s.person.id))
        .filter(Boolean);
      for (const sp of sps) {
        if (sp.x > n.x) {
          edges.push({
            id: `edge_m_center_${n.id}_${sp.id}`,
            type: 'marriage',
            fromId: n.id,
            toId: sp.id,
            d: createHorizontalConnector(n.x + CARD_WIDTH, n.y + CARD_HEIGHT / 2, sp.x)
          });
        }
      }
    }
  }

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

  // Generate horizontal generation panels
  const panels = [];
  if (nodes.length > 0) {
    let minGen = 0;
    let maxGen = 0;
    for (const n of nodes) {
      const g = Math.round(n.y / TIER_HEIGHT);
      if (g < minGen) minGen = g;
      if (g > maxGen) maxGen = g;
    }

    const panelX = minX - 10000;
    const panelWidth = (maxX - minX) + 20000;

    for (let gen = minGen; gen <= maxGen; gen++) {
      const panelY = gen * TIER_HEIGHT - TIER_GAP / 2;
      panels.push({
        id: `gen_panel_hg_${gen}`,
        generation: gen,
        isEven: Math.abs(gen) % 2 === 0,
        x: panelX,
        y: panelY,
        width: panelWidth,
        height: TIER_HEIGHT
      });
    }
  }

  return {
    nodes,
    families: familyNodes,
    edges,
    bounds: {
      minX: minX - 40,
      minY: minY - 40,
      maxX: maxX + 40,
      maxY: maxY + 40,
      width: (maxX - minX) + 80,
      height: (maxY - minY) + 80
    },
    panels
  };
}
