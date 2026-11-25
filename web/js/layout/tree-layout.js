// tree-layout.js - Untangled Genealogical DAG layout engine for Network and Hourglass views

import { createCurvedConnector, createHorizontalConnector } from './bezier.js';

export const CARD_WIDTH = 272;
export const CARD_HEIGHT = 92;
export const TIER_GAP = 124;
export const TIER_HEIGHT = CARD_HEIGHT + TIER_GAP; // 216px
export const NODE_SPACING_X = 20;
export const CLUSTER_SPACING_X = 36;

/**
 * Calculates a full generational network layout containing all people and families.
 * Uses connected-component partitioning, bidirectional generational ranking,
 * nuclear family clustering, and symmetric VPSC block compaction to eliminate
 * horizontal drift and huge empty gaps.
 * @param {GraphStore} graphStore
 * @returns {Object} Layout result { nodes, families, edges, bounds, panels, lineage }
 */
export function layoutAll(graphStore) {
  const people = graphStore.getAllPeople();
  const families = graphStore.getAllFamilies();

  if (people.length === 0) {
    return {
      nodes: [],
      families: [],
      edges: [],
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
      panels: []
    };
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

  // Separate connected people from completely isolated singletons (no parents, no spouse, no children)
  const isolatedPeople = [];
  const connectedPeople = [];
  for (const p of people) {
    const hasParentFam = childToParentFamilyId.has(p.id) || Boolean(p.familyIdAsChild);
    const hasSpouseFam = (familiesByPartnerId.get(p.id) || []).length > 0;
    if (!hasParentFam && !hasSpouseFam) {
      isolatedPeople.push(p);
    } else {
      connectedPeople.push(p);
    }
  }

  // 1. Calculate exact generational ranks for connected people using bidirectional BFS
  // (+1 for parent -> child, -1 for child -> parent, 0 for spouse -> spouse)
  const genMap = new Map();
  const adj = new Map();
  for (const p of people) {
    genMap.set(p.id, 0);
    adj.set(p.id, []);
  }

  for (const f of families) {
    const partnerIds = (f.partnerIds || []).filter(id => adj.has(id));
    const childIds = (f.children || []).map(c => c.personId).filter(id => adj.has(id));

    for (let i = 0; i < partnerIds.length; i++) {
      for (let j = i + 1; j < partnerIds.length; j++) {
        adj.get(partnerIds[i]).push({ to: partnerIds[j], delta: 0 });
        adj.get(partnerIds[j]).push({ to: partnerIds[i], delta: 0 });
      }
    }
    for (const pId of partnerIds) {
      for (const cId of childIds) {
        adj.get(pId).push({ to: cId, delta: 1 });
        adj.get(cId).push({ to: pId, delta: -1 });
      }
    }
  }

  const visited = new Set();
  for (const p of connectedPeople) {
    if (visited.has(p.id)) continue;
    const compNodes = [];
    const queue = [p.id];
    visited.add(p.id);
    genMap.set(p.id, 0);

    while (queue.length > 0) {
      const curr = queue.shift();
      compNodes.push(curr);
      const currGen = genMap.get(curr) ?? 0;

      for (const edge of (adj.get(curr) || [])) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          genMap.set(edge.to, currGen + edge.delta);
          queue.push(edge.to);
        }
      }
    }

    // Normalize this connected component so its earliest generation is 0
    let compMin = Infinity;
    for (const id of compNodes) {
      const g = genMap.get(id) ?? 0;
      if (g < compMin) compMin = g;
    }
    if (compMin !== Infinity && compMin !== 0) {
      for (const id of compNodes) {
        genMap.set(id, (genMap.get(id) ?? 0) - compMin);
      }
    }
  }

  // Compute median birth year per generation to place isolated individuals in their historical tier
  const genYears = new Map();
  for (const p of connectedPeople) {
    const g = genMap.get(p.id) ?? 0;
    const by = graphStore.getBirthYear(p);
    if (by) {
      if (!genYears.has(g)) genYears.set(g, []);
      genYears.get(g).push(by);
    }
  }
  const genMedianYear = new Map();
  for (const [g, yrs] of genYears.entries()) {
    yrs.sort((a, b) => a - b);
    genMedianYear.set(g, yrs[Math.floor(yrs.length / 2)]);
  }

  for (const iso of isolatedPeople) {
    const by = graphStore.getBirthYear(iso);
    if (by && genMedianYear.size > 0) {
      let bestGen = 0;
      let bestDiff = Infinity;
      for (const [g, med] of genMedianYear.entries()) {
        const diff = Math.abs(by - med);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestGen = g;
        }
      }
      genMap.set(iso.id, bestGen);
    } else {
      genMap.set(iso.id, 0);
    }
  }

  // Group connected individuals by generation first
  const tiers = new Map();
  for (const p of connectedPeople) {
    const gen = genMap.get(p.id) ?? 0;
    if (!tiers.has(gen)) tiers.set(gen, []);
    tiers.get(gen).push(p);
  }
  // If all people are isolated, include them in tiers directly
  if (connectedPeople.length === 0) {
    for (const p of isolatedPeople) {
      const gen = genMap.get(p.id) ?? 0;
      if (!tiers.has(gen)) tiers.set(gen, []);
      tiers.get(gen).push(p);
    }
    isolatedPeople.length = 0;
  }

  const sortedGens = Array.from(tiers.keys()).sort((a, b) => a - b);

  // 2. Form cohesive layout units per tier (couples, multi-spouse chains, and individuals)
  const tierUnits = new Map();
  for (const gen of sortedGens) {
    const tierPeople = tiers.get(gen);
    // Deterministic initial sort by birth year then name
    tierPeople.sort((a, b) => {
      const ya = graphStore.getBirthYear(a) || 9999;
      const yb = graphStore.getBirthYear(b) || 9999;
      if (ya !== yb) return ya - yb;
      return graphStore.getDisplayName(a).localeCompare(graphStore.getDisplayName(b), 'da');
    });

    const tierPersonSet = new Set(tierPeople.map(p => p.id));
    const processed = new Set();
    const units = [];

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

      let orderedPeopleIds = [];
      if (component.length <= 2) {
        orderedPeopleIds = component;
      } else {
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
        barycenter: 0,
        hasDesiredBarycenter: false
      });
    }

    tierUnits.set(gen, units);
  }

  // 3. Symmetric Block Compaction (1D VPSC):
  // Places units as close as possible to their ideal barycenters while resolving overlaps
  // symmetrically around the merged block's center of mass (zero rightward drift).
  function assignTierCoordinatesSymmetric(units, spacing) {
    if (!units || units.length === 0) return;

    const blocks = [];
    for (const u of units) {
      const block = {
        units: [u],
        offsets: [0],
        width: u.width,
        weightSum: u.barycenter - u.width / 2,
        count: 1,
        x: u.barycenter - u.width / 2
      };
      blocks.push(block);

      while (blocks.length >= 2) {
        const right = blocks[blocks.length - 1];
        const left = blocks[blocks.length - 2];
        if (left.x + left.width + spacing <= right.x) {
          break;
        }
        // Merge right into left
        blocks.pop();
        const baseOffset = left.width + spacing;
        for (let i = 0; i < right.units.length; i++) {
          const ru = right.units[i];
          const newOffset = baseOffset + right.offsets[i];
          left.units.push(ru);
          left.offsets.push(newOffset);
          left.weightSum += (ru.barycenter - ru.width / 2 - newOffset);
          left.count += 1;
        }
        left.width = baseOffset + right.width;
        left.x = left.weightSum / left.count;
      }
    }

    for (const b of blocks) {
      for (let i = 0; i < b.units.length; i++) {
        b.units[i].x = b.x + b.offsets[i];
      }
    }
  }

  // Center each tier around X = 0 initially
  for (const gen of sortedGens) {
    const units = tierUnits.get(gen) || [];
    let totalW = 0;
    for (let i = 0; i < units.length; i++) {
      totalW += units[i].width + (i > 0 ? CLUSTER_SPACING_X : 0);
    }
    let curX = -totalW / 2;
    for (const u of units) {
      u.x = curX;
      u.barycenter = curX + u.width / 2;
      curX += u.width + CLUSTER_SPACING_X;
    }
  }

  // Helper to get parent X coordinates for a unit
  function getParentCenters(u, parentUnits) {
    const parentXs = [];
    for (const person of u.people) {
      const pfamId = childToParentFamilyId.get(person.id) || person.familyIdAsChild;
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
    return parentXs;
  }

  // Helper to get child X coordinates for a unit
  function getChildCenters(u, childUnits) {
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
    return childXs;
  }

  // 4. Two-way Sugiyama Barycenter Sweeps with Symmetric Block Compaction
  const SWEEP_COUNT = 18;
  for (let sweep = 0; sweep < SWEEP_COUNT; sweep++) {
    // A. Downward sweep (Tier 0 to max)
    for (const gen of sortedGens) {
      const units = tierUnits.get(gen) || [];
      const parentUnits = tierUnits.get(gen - 1) || [];
      const childUnits = tierUnits.get(gen + 1) || [];

      for (const u of units) {
        const parentXs = getParentCenters(u, parentUnits);
        const childXs = getChildCenters(u, childUnits);

        if (parentXs.length > 0 && childXs.length > 0) {
          const pAvg = parentXs.reduce((a, b) => a + b, 0) / parentXs.length;
          const cAvg = childXs.reduce((a, b) => a + b, 0) / childXs.length;
          u.barycenter = pAvg * 0.75 + cAvg * 0.25;
        } else if (parentXs.length > 0) {
          u.barycenter = parentXs.reduce((a, b) => a + b, 0) / parentXs.length;
        } else if (childXs.length > 0) {
          u.barycenter = childXs.reduce((a, b) => a + b, 0) / childXs.length;
        } else {
          u.barycenter = u.x + u.width / 2;
        }
      }

      units.sort((a, b) => a.barycenter - b.barycenter);
      assignTierCoordinatesSymmetric(units, CLUSTER_SPACING_X);
    }

    // B. Upward sweep (Tier max to 0)
    for (let gIdx = sortedGens.length - 1; gIdx >= 0; gIdx--) {
      const gen = sortedGens[gIdx];
      const units = tierUnits.get(gen) || [];
      const parentUnits = tierUnits.get(gen - 1) || [];
      const childUnits = tierUnits.get(gen + 1) || [];

      for (const u of units) {
        const childXs = getChildCenters(u, childUnits);
        const parentXs = getParentCenters(u, parentUnits);

        if (childXs.length > 0 && parentXs.length > 0) {
          const cAvg = childXs.reduce((a, b) => a + b, 0) / childXs.length;
          const pAvg = parentXs.reduce((a, b) => a + b, 0) / parentXs.length;
          u.barycenter = cAvg * 0.75 + pAvg * 0.25;
        } else if (childXs.length > 0) {
          u.barycenter = childXs.reduce((a, b) => a + b, 0) / childXs.length;
        } else if (parentXs.length > 0) {
          u.barycenter = parentXs.reduce((a, b) => a + b, 0) / parentXs.length;
        } else {
          u.barycenter = u.x + u.width / 2;
        }
      }

      units.sort((a, b) => a.barycenter - b.barycenter);
      assignTierCoordinatesSymmetric(units, CLUSTER_SPACING_X);
    }
  }

  // Dock any isolated people neatly onto their chronological generation tier right beside existing units
  if (isolatedPeople.length > 0) {
    isolatedPeople.sort((a, b) => {
      const ya = graphStore.getBirthYear(a) || 9999;
      const yb = graphStore.getBirthYear(b) || 9999;
      return ya - yb;
    });

    for (const iso of isolatedPeople) {
      const gen = genMap.get(iso.id) ?? 0;
      if (!tierUnits.has(gen)) {
        tierUnits.set(gen, []);
        sortedGens.push(gen);
        sortedGens.sort((a, b) => a - b);
      }
      const units = tierUnits.get(gen);
      let minTierX = 0;
      if (units.length > 0) {
        minTierX = Math.min(...units.map(u => u.x));
      }
      const isoX = minTierX - CARD_WIDTH - CLUSTER_SPACING_X * 1.5;
      units.unshift({
        people: [iso],
        width: CARD_WIDTH,
        x: isoX,
        barycenter: isoX + CARD_WIDTH / 2
      });
    }
  }

  // Normalize all X coordinates so layout starts with a clean left margin (x = 40)
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
          generation: gen,
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

    if (partnerNodes.length >= 2) {
      const sortedPartners = [...partnerNodes].sort((a, b) => a.x - b.x);
      const leftNode = sortedPartners[0];
      const rightNode = sortedPartners[sortedPartners.length - 1];

      anchorX = (leftNode.x + CARD_WIDTH + rightNode.x) / 2;
      anchorY = leftNode.y + CARD_HEIGHT / 2;

      edges.push({
        id: `edge_m_${f.id}`,
        type: 'marriage',
        fromId: leftNode.id,
        toId: rightNode.id,
        partnerIds: partnerNodes.map(n => n.id),
        familyId: f.id,
        d: createHorizontalConnector(leftNode.x + CARD_WIDTH, anchorY, rightNode.x)
      });
    } else if (partnerNodes.length === 1) {
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
          partnerIds: partnerNodes.map(n => n.id),
          childId: childNode.id,
          familyId: f.id,
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

  // 8. Generate horizontal generation panels with rich metadata (era years & counts)
  const panels = [];
  if (sortedGens.length > 0 && nodes.length > 0) {
    const firstGen = sortedGens[0];
    const lastGen = sortedGens[sortedGens.length - 1];
    const panelX = minX - 200;
    const panelWidth = (maxX - minX) + 320;

    for (let gen = firstGen; gen <= lastGen; gen++) {
      const panelY = gen * TIER_HEIGHT + 40 - TIER_GAP / 2;
      const tierNodes = nodes.filter(n => n.generation === gen);
      const years = tierNodes
        .map(n => graphStore.getBirthYear(n.person))
        .filter(Boolean)
        .sort((a, b) => a - b);

      let yearRange = '';
      if (years.length === 1) {
        yearRange = `* ${years[0]}`;
      } else if (years.length > 1) {
        yearRange = `${years[0]} – ${years[years.length - 1]}`;
      }

      panels.push({
        id: `gen_panel_${gen}`,
        generation: gen,
        label: `${gen + 1}. Generation`,
        yearRange,
        personCount: tierNodes.length,
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
      minX: minX - 200,
      minY,
      maxX: maxX + 80,
      maxY: maxY + 40,
      width: (maxX - minX) + 280,
      height: (maxY - minY) + 80
    },
    panels
  };
}

/**
 * Calculates an Hourglass lineage layout centered on a specific focus person.
 * Ancestors expand upwards symmetrically over couple midpoints, descendants expand downwards,
 * and immediate siblings + spouses sit on the center tier for complete nuclear family context.
 * @param {GraphStore} graphStore
 * @param {string} focusPersonId
 * @returns {Object} Layout result { nodes, families, edges, bounds, panels }
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

  function addNode(person, x, y, generation = 0) {
    if (nodeMap.has(person.id)) return nodeMap.get(person.id);
    const nodeObj = {
      id: person.id,
      person,
      generation,
      x,
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT
    };
    nodeMap.set(person.id, nodeObj);
    nodes.push(nodeObj);
    return nodeObj;
  }

  // 1. Center Tier (Gen 0): Focus Person, Spouses, and Immediate Siblings
  const spouses = graphStore.getSpouses(rootPerson.id).map(s => s.person);
  const parentsOfRoot = graphStore.getParents(rootPerson.id);

  // Collect full/half siblings from rootPerson's parents
  const siblingMap = new Map();
  for (const parent of parentsOfRoot) {
    for (const cLink of graphStore.getChildren(parent.id)) {
      if (cLink.person.id !== rootPerson.id && !spouses.some(s => s.id === cLink.person.id)) {
        siblingMap.set(cLink.person.id, cLink.person);
      }
    }
  }
  const siblings = Array.from(siblingMap.values()).sort((a, b) => {
    const ya = graphStore.getBirthYear(a) || 9999;
    const yb = graphStore.getBirthYear(b) || 9999;
    return ya - yb;
  });

  // Split siblings left and right of the focus couple so the focus person stays near X = 0
  const halfSibs = Math.floor(siblings.length / 2);
  const leftSiblings = siblings.slice(0, halfSibs);
  const rightSiblings = siblings.slice(halfSibs);

  // Place focus person at x = -CARD_WIDTH / 2, spouses immediately to the right
  const focusCouple = [rootPerson, ...spouses];
  const focusCoupleWidth = focusCouple.length * CARD_WIDTH + Math.max(0, focusCouple.length - 1) * NODE_SPACING_X;
  const focusStartX = -focusCoupleWidth / 2;

  for (let i = 0; i < focusCouple.length; i++) {
    addNode(focusCouple[i], focusStartX + i * (CARD_WIDTH + NODE_SPACING_X), 0, 0);
  }

  // Place left siblings to the left of the focus person
  let leftCursor = focusStartX - CLUSTER_SPACING_X - CARD_WIDTH;
  for (let i = leftSiblings.length - 1; i >= 0; i--) {
    addNode(leftSiblings[i], leftCursor, 0, 0);
    leftCursor -= (CARD_WIDTH + NODE_SPACING_X);
  }

  // Place right siblings to the right of the focus couple
  let rightCursor = focusStartX + focusCoupleWidth + CLUSTER_SPACING_X;
  for (let i = 0; i < rightSiblings.length; i++) {
    addNode(rightSiblings[i], rightCursor, 0, 0);
    rightCursor += (CARD_WIDTH + NODE_SPACING_X);
  }

  // 2. Ancestors (Generations -1, -2, -3, -4) with symmetric subtree width allocation
  function getAncestorSubtreeWidth(personId, depth) {
    if (depth > 4) return CARD_WIDTH;
    const parents = graphStore.getParents(personId);
    if (parents.length === 0) return CARD_WIDTH;
    if (parents.length === 1) {
      return Math.max(CARD_WIDTH, getAncestorSubtreeWidth(parents[0].id, depth + 1));
    }
    const w0 = getAncestorSubtreeWidth(parents[0].id, depth + 1);
    const w1 = getAncestorSubtreeWidth(parents[1].id, depth + 1);
    return Math.max(2 * CARD_WIDTH + NODE_SPACING_X, w0 + w1 + CLUSTER_SPACING_X);
  }

  function buildAncestorsSymmetric(childPerson, centerX, currentGen) {
    if (Math.abs(currentGen) > 4) return;
    const parents = graphStore.getParents(childPerson.id);
    if (parents.length === 0) return;

    const parentY = currentGen * TIER_HEIGHT;

    if (parents.length === 1) {
      const pNode = addNode(parents[0], centerX - CARD_WIDTH / 2, parentY, currentGen);
      buildAncestorsSymmetric(parents[0], pNode.x + CARD_WIDTH / 2, currentGen - 1);
      return;
    }

    // Place the parent couple centered at centerX, or separated enough so their upper ancestor trees don't collide
    const p0 = parents[0];
    const p1 = parents[1];
    const p0Grandparents = graphStore.getParents(p0.id);
    const p1Grandparents = graphStore.getParents(p1.id);

    // Couple cards themselves sit side-by-side centered at centerX
    const coupleWidth = 2 * CARD_WIDTH + NODE_SPACING_X;
    const p0Node = addNode(p0, centerX - coupleWidth / 2, parentY, currentGen);
    const p1Node = addNode(p1, centerX - coupleWidth / 2 + CARD_WIDTH + NODE_SPACING_X, parentY, currentGen);

    if (p0Grandparents.length > 0 && p1Grandparents.length > 0) {
      const w0 = getAncestorSubtreeWidth(p0.id, Math.abs(currentGen) + 1);
      const w1 = getAncestorSubtreeWidth(p1.id, Math.abs(currentGen) + 1);
      const totalSpan = w0 + CLUSTER_SPACING_X + w1;
      const leftCenter = centerX - totalSpan / 2 + w0 / 2;
      const rightCenter = centerX + totalSpan / 2 - w1 / 2;
      buildAncestorsSymmetric(p0, leftCenter, currentGen - 1);
      buildAncestorsSymmetric(p1, rightCenter, currentGen - 1);
    } else {
      buildAncestorsSymmetric(p0, p0Node.x + CARD_WIDTH / 2, currentGen - 1);
      buildAncestorsSymmetric(p1, p1Node.x + CARD_WIDTH / 2, currentGen - 1);
    }
  }

  // 3. Descendants (Generations +1, +2, +3, +4) with bottom-up subtree width allocation
  function getDescendantSubtreeWidth(personId, depth) {
    if (depth > 4) return CARD_WIDTH;
    const childrenLinks = graphStore.getChildren(personId);
    if (childrenLinks.length === 0) return CARD_WIDTH;
    let sum = 0;
    for (let i = 0; i < childrenLinks.length; i++) {
      sum += getDescendantSubtreeWidth(childrenLinks[i].person.id, depth + 1);
      if (i > 0) sum += NODE_SPACING_X;
    }
    return Math.max(CARD_WIDTH, sum);
  }

  function buildDescendantsSymmetric(parentPerson, centerX, currentGen) {
    if (currentGen > 4) return;
    const childrenLinks = graphStore.getChildren(parentPerson.id);
    if (childrenLinks.length === 0) return;

    const childY = currentGen * TIER_HEIGHT;
    const childWidths = childrenLinks.map(cl => getDescendantSubtreeWidth(cl.person.id, currentGen + 1));
    const totalWidth = childWidths.reduce((a, b) => a + b, 0) + Math.max(0, childrenLinks.length - 1) * NODE_SPACING_X;

    let cursorX = centerX - totalWidth / 2;
    for (let i = 0; i < childrenLinks.length; i++) {
      const childPerson = childrenLinks[i].person;
      const w = childWidths[i];
      const childCenterX = cursorX + w / 2;
      const childNode = addNode(childPerson, childCenterX - CARD_WIDTH / 2, childY, currentGen);
      buildDescendantsSymmetric(childPerson, childNode.x + CARD_WIDTH / 2, currentGen + 1);
      cursorX += w + NODE_SPACING_X;
    }
  }

  const focusNode = nodeMap.get(rootPerson.id);
  buildAncestorsSymmetric(rootPerson, focusNode.x + CARD_WIDTH / 2, -1);

  // If the focus person has descendants, show them; otherwise also expand descendants of siblings
  const rootChildren = graphStore.getChildren(rootPerson.id);
  if (rootChildren.length > 0) {
    buildDescendantsSymmetric(rootPerson, 0, 1);
  } else {
    for (const sib of siblings) {
      const sibNode = nodeMap.get(sib.id);
      if (sibNode) {
        buildDescendantsSymmetric(sib, sibNode.x + CARD_WIDTH / 2, 1);
      }
    }
  }

  // 4. Overlap Prevention across tiers in Hourglass view
  const tierMap = new Map();
  for (const n of nodes) {
    const gen = Math.round(n.y / TIER_HEIGHT);
    if (!tierMap.has(gen)) tierMap.set(gen, []);
    tierMap.get(gen).push(n);
  }

  for (const [, tierNodes] of tierMap.entries()) {
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

  // 5. Build edges with updated coordinates (deduplicated marriage edges)
  const marriageEdgeSet = new Set();
  for (const n of nodes) {
    const parents = graphStore.getParents(n.id)
      .map(p => nodeMap.get(p.id))
      .filter(Boolean);

    if (parents.length === 2) {
      const pLeft = parents[0].x < parents[1].x ? parents[0] : parents[1];
      const pRight = parents[0].x < parents[1].x ? parents[1] : parents[0];
      const anchorX = (pLeft.x + CARD_WIDTH + pRight.x) / 2;
      const anchorY = pLeft.y + CARD_HEIGHT / 2;
      const mKey = `${pLeft.id}_${pRight.id}`;

      if (!marriageEdgeSet.has(mKey)) {
        marriageEdgeSet.add(mKey);
        edges.push({
          id: `edge_m_anc_${pLeft.id}_${pRight.id}`,
          type: 'marriage',
          fromId: pLeft.id,
          toId: pRight.id,
          partnerIds: [pLeft.id, pRight.id],
          d: createHorizontalConnector(pLeft.x + CARD_WIDTH, anchorY, pRight.x)
        });
      }

      edges.push({
        id: `edge_c_anc_${pLeft.id}_${n.id}`,
        type: 'child',
        fromId: `${pLeft.id}_${pRight.id}`,
        toId: n.id,
        partnerIds: [pLeft.id, pRight.id],
        childId: n.id,
        d: createCurvedConnector(anchorX, anchorY, n.x + CARD_WIDTH / 2, n.y)
      });
    } else if (parents.length === 1) {
      const p = parents[0];
      edges.push({
        id: `edge_c_anc_${p.id}_${n.id}`,
        type: 'child',
        fromId: p.id,
        toId: n.id,
        partnerIds: [p.id],
        childId: n.id,
        d: createCurvedConnector(p.x + CARD_WIDTH / 2, p.y + CARD_HEIGHT, n.x + CARD_WIDTH / 2, n.y)
      });
    }

    if (n.y === 0) {
      const sps = graphStore.getSpouses(n.id)
        .map(s => nodeMap.get(s.person.id))
        .filter(Boolean);
      for (const sp of sps) {
        if (sp.x > n.x) {
          const mKey = `${n.id}_${sp.id}`;
          if (!marriageEdgeSet.has(mKey)) {
            marriageEdgeSet.add(mKey);
            edges.push({
              id: `edge_m_center_${n.id}_${sp.id}`,
              type: 'marriage',
              fromId: n.id,
              toId: sp.id,
              partnerIds: [n.id, sp.id],
              d: createHorizontalConnector(n.x + CARD_WIDTH, n.y + CARD_HEIGHT / 2, sp.x)
            });
          }
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

  // Generate horizontal generation panels with labels
  const panels = [];
  if (nodes.length > 0) {
    let minGen = 0;
    let maxGen = 0;
    for (const n of nodes) {
      const g = Math.round(n.y / TIER_HEIGHT);
      if (g < minGen) minGen = g;
      if (g > maxGen) maxGen = g;
    }

    const panelX = minX - 200;
    const panelWidth = (maxX - minX) + 320;

    for (let gen = minGen; gen <= maxGen; gen++) {
      const panelY = gen * TIER_HEIGHT - TIER_GAP / 2;
      const tierNodes = nodes.filter(n => Math.round(n.y / TIER_HEIGHT) === gen);
      const years = tierNodes
        .map(n => graphStore.getBirthYear(n.person))
        .filter(Boolean)
        .sort((a, b) => a - b);

      let yearRange = '';
      if (years.length === 1) {
        yearRange = `* ${years[0]}`;
      } else if (years.length > 1) {
        yearRange = `${years[0]} – ${years[years.length - 1]}`;
      }

      let relLabel = 'Fokusgeneration';
      if (gen === -1) relLabel = 'Forældre';
      else if (gen === -2) relLabel = 'Bedsteforældre';
      else if (gen === -3) relLabel = 'Oldeforældre';
      else if (gen === -4) relLabel = 'Tipoldeforældre';
      else if (gen === 1) relLabel = 'Børn / Nevøer & Niecer';
      else if (gen === 2) relLabel = 'Børnebørn';
      else if (gen > 2) relLabel = `+${gen}. Generation`;

      panels.push({
        id: `gen_panel_hg_${gen}`,
        generation: gen,
        label: relLabel,
        yearRange,
        personCount: tierNodes.length,
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
      minX: minX - 200,
      minY: minY - 40,
      maxX: maxX + 80,
      maxY: maxY + 40,
      width: (maxX - minX) + 280,
      height: (maxY - minY) + 80
    },
    panels
  };
}
