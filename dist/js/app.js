// app.js - Main entrypoint for Genea Static Interactive Tree Viewer

import { GraphStore } from './graph-store.js';
import { layoutAll, layoutHourglass } from './layout/tree-layout.js';
import { renderNodeCard } from './components/node-card.js';
import { SVGViewport } from './viewport/svg-viewport.js';
import { SynchronizedScrollbars } from './viewport/scrollbars.js';
import { ViewportControls } from './viewport/controls.js';
import { PersonModal } from './components/person-modal.js';
import { AppState } from './state.js';
import { createSVG, clearChildren } from './utils/dom.js';

class GeneaApp {
  constructor() {
    this.graphStore = null;
    this.viewport = null;
    this.scrollbars = null;
    this.controls = null;
    this.modal = null;
    this.state = null;

    this.currentLayout = null;
    this.nodePositions = new Map();
  }

  async init() {
    // 1. Load data
    let bundle = null;
    if (window.GENEA_DATA && window.GENEA_DATA.people) {
      bundle = window.GENEA_DATA;
    } else {
      try {
        const resp = await fetch('data.json');
        if (resp.ok) {
          bundle = await resp.json();
        }
      } catch (err) {
        console.warn('Could not load data.json via fetch:', err);
      }
    }

    if (!bundle) {
      document.body.innerHTML = '<div style="padding: 2rem; color: #ef4444; font-family: sans-serif;">Failed to load genealogy dataset.</div>';
      return;
    }

    // 2. Initialize GraphStore
    this.graphStore = new GraphStore(bundle);

    // 3. Initialize Viewport
    const svgEl = document.getElementById('tree-svg');
    this.viewport = new SVGViewport(svgEl, {
      onViewportChange: (vb) => {
        if (this.scrollbars) this.scrollbars.update();
        if (this.controls) {
          this.controls.updateMinimapViewport();
          this.controls.updateZoomIndicator(vb.zoom);
        }
        this._updateSemanticZoomClass(vb.zoom);
      }
    });

    // 4. Initialize Scrollbars
    this.scrollbars = new SynchronizedScrollbars({
      trackH: document.getElementById('scrollbar-h'),
      thumbH: document.getElementById('thumb-h'),
      trackV: document.getElementById('scrollbar-v'),
      thumbV: document.getElementById('thumb-v')
    }, this.viewport);

    // 5. Initialize Controls
    this.controls = new ViewportControls({
      toolbar: document.getElementById('controls-toolbar'),
      minimapCanvas: document.getElementById('minimap-canvas'),
      minimapViewport: document.getElementById('minimap-viewport')
    }, this.viewport, () => {
      return this.currentLayout ? this.currentLayout.bounds : { minX: 0, minY: 0, width: 800, height: 600, maxX: 800, maxY: 600 };
    }, () => {
      return this.state?.selectedPersonId;
    }, (id) => {
      return this.nodePositions.get(id) || null;
    });

    // 6. Initialize Modal
    const dialogEl = document.getElementById('person-dialog');
    this.modal = new PersonModal(dialogEl, this.graphStore, {
      onNavigate: (relId) => {
        this.state.selectPerson(relId, false);
        this.centerOnPerson(relId);
      },
      onCenterTree: (pId) => {
        this.centerOnPerson(pId, 0.85);
        this.modal.close();
      }
    });

    // 7. Initialize Application State & Search Router
    this.state = new AppState(this.graphStore, {
      onSelectPerson: (personId, fromHash, openModal = true) => {
        if (this.state.viewMode === 'hourglass') {
          this.renderTree();
        }
        this.updateNodeSelection(personId);
        if (this.controls) this.controls.renderMinimap();
        if (openModal) {
          this.modal.open(personId);
        }
      },
      onViewModeChange: (mode) => {
        this.updateViewModeButtons(mode);
        this.renderTree();
        if (mode === 'network') {
          this.viewport.fitToBox(this.currentLayout.bounds, 36);
        } else {
          this.viewport.fitToBox(this.currentLayout.bounds, 48);
        }
      },
      onFocusUniqueMatch: (personId) => {
        this.state.selectPerson(personId, false);
        this.centerOnPerson(personId, 0.85);
      }
    });

    // Bind Focus on Person search input and header quick actions
    const searchInput = document.getElementById('focus-person-input');
    const searchResults = document.getElementById('search-results');
    this.state.bindFocusPersonInput(searchInput, searchResults);
    this._bindHeaderPersonActions();

    // Bind view mode toggle buttons
    this._bindViewControls();

    // Bind Theme Toggle
    this._bindThemeToggle();

    // 8. Initial Render & Routing
    this.state.initFromHash();
    this.state.syncInputWithSelectedPerson(true);
    this.updateViewModeButtons(this.state.viewMode);
    this.renderTree();

    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const explicitPerson = hashParams.get('person');

    if (explicitPerson && this.nodePositions.has(explicitPerson) && this.state.viewMode !== 'hourglass') {
      this.centerOnPerson(explicitPerson, 0.8);
    } else if (this.currentLayout) {
      this.viewport.fitToBox(this.currentLayout.bounds, 36);
    }
  }

  _updateSemanticZoomClass(zoom) {
    const svgEl = document.getElementById('tree-svg');
    if (!svgEl) return;
    if (zoom < 0.42) {
      svgEl.classList.add('zoom-overview');
    } else {
      svgEl.classList.remove('zoom-overview');
    }
  }

  _bindHeaderPersonActions() {
    const btnZoomPerson = document.getElementById('btn-header-zoom-person');
    const btnPersonDetails = document.getElementById('btn-header-person-details');

    btnZoomPerson?.addEventListener('click', () => {
      const selId = this.state?.selectedPersonId;
      if (selId) {
        this.centerOnPerson(selId, 0.85);
      }
    });

    btnPersonDetails?.addEventListener('click', () => {
      const selId = this.state?.selectedPersonId;
      if (selId) {
        this.modal.open(selId);
      }
    });
  }

  _bindViewControls() {
    const btnHourglass = document.getElementById('btn-view-hourglass');
    const btnNetwork = document.getElementById('btn-view-network');

    btnHourglass?.addEventListener('click', () => {
      this.state.setViewMode('hourglass');
    });

    btnNetwork?.addEventListener('click', () => {
      this.state.setViewMode('network');
    });
  }

  updateViewModeButtons(mode) {
    const btnHourglass = document.getElementById('btn-view-hourglass');
    const btnNetwork = document.getElementById('btn-view-network');

    if (mode === 'hourglass') {
      btnHourglass?.classList.add('active');
      btnNetwork?.classList.remove('active');
    } else {
      btnNetwork?.classList.add('active');
      btnHourglass?.classList.remove('active');
    }
  }

  _bindThemeToggle() {
    const toggleBtn = document.getElementById('btn-toggle-theme');
    if (!toggleBtn) return;

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      toggleBtn.textContent = next === 'dark' ? '☀️' : '🌙';
    });
  }

  computeLineageSet(personId) {
    const lineageNodes = new Set();
    if (!personId) return lineageNodes;

    lineageNodes.add(personId);

    for (const sp of this.graphStore.getSpouses(personId)) {
      lineageNodes.add(sp.person.id);
    }

    const ancQueue = [personId];
    const visitedAnc = new Set([personId]);
    while (ancQueue.length > 0) {
      const curr = ancQueue.shift();
      for (const p of this.graphStore.getParents(curr)) {
        lineageNodes.add(p.id);
        if (!visitedAnc.has(p.id)) {
          visitedAnc.add(p.id);
          ancQueue.push(p.id);
        }
      }
    }

    const descQueue = [personId];
    const visitedDesc = new Set([personId]);
    while (descQueue.length > 0) {
      const curr = descQueue.shift();
      for (const ch of this.graphStore.getChildren(curr)) {
        lineageNodes.add(ch.person.id);
        if (!visitedDesc.has(ch.person.id)) {
          visitedDesc.add(ch.person.id);
          descQueue.push(ch.person.id);
        }
      }
    }

    return lineageNodes;
  }

  renderTree() {
    const viewMode = this.state.viewMode;
    const focusPersonId = this.state.selectedPersonId || this.graphStore.findDefaultRootPerson()?.id;

    if (viewMode === 'hourglass') {
      this.currentLayout = layoutHourglass(this.graphStore, focusPersonId);
    } else {
      this.currentLayout = layoutAll(this.graphStore);
    }

    const { nodes, edges, bounds } = this.currentLayout;

    // Update node positions map
    this.nodePositions.clear();
    for (const n of nodes) {
      this.nodePositions.set(n.id, n);
    }

    // Render SVG layers
    const panelsLayer = document.getElementById('panels-layer');
    const edgesLayer = document.getElementById('edges-layer');
    const nodesLayer = document.getElementById('nodes-layer');
    if (panelsLayer) clearChildren(panelsLayer);
    clearChildren(edgesLayer);
    clearChildren(nodesLayer);

    // Generation Panels & Era Headers
    if (panelsLayer && this.currentLayout.panels) {
      for (const panel of this.currentLayout.panels) {
        const panelGroup = createSVG('g', {
          class: 'generation-band-group',
          'data-generation': panel.generation
        });

        const rectEl = createSVG('rect', {
          id: panel.id,
          class: `generation-panel ${panel.isEven ? 'generation-panel-even' : 'generation-panel-odd'}`,
          x: panel.x,
          y: panel.y,
          width: panel.width,
          height: panel.height,
          rx: 10,
          ry: 10,
          'data-generation': panel.generation
        });
        panelGroup.appendChild(rectEl);

        if (panel.label && panel.personCount > 0) {
          const labelX = panel.x + 22;
          const labelY = panel.y + 34;

          const titleText = createSVG('text', {
            class: 'generation-label-title',
            x: labelX,
            y: labelY
          }, [panel.label]);
          panelGroup.appendChild(titleText);

          if (panel.yearRange) {
            const yearText = createSVG('text', {
              class: 'generation-label-years',
              x: labelX,
              y: labelY + 22
            }, [panel.yearRange]);
            panelGroup.appendChild(yearText);
          }

          const countText = createSVG('text', {
            class: 'generation-label-count',
            x: labelX,
            y: labelY + (panel.yearRange ? 42 : 22)
          }, [`${panel.personCount} ${panel.personCount === 1 ? 'person' : 'personer'}`]);
          panelGroup.appendChild(countText);
        }

        panelsLayer.appendChild(panelGroup);
      }
    }

    // Edges
    for (const edge of edges) {
      const attrs = {
        id: edge.id,
        class: `edge edge-${edge.type}`,
        d: edge.d,
        'data-from': edge.fromId || '',
        'data-to': edge.toId || ''
      };
      if (edge.partnerIds) {
        attrs['data-partners'] = edge.partnerIds.join(',');
      }
      if (edge.childId) {
        attrs['data-child'] = edge.childId;
      }
      const pathEl = createSVG('path', attrs);
      edgesLayer.appendChild(pathEl);
    }

    // Nodes
    const selectedId = this.state.selectedPersonId;
    for (const node of nodes) {
      const isSelected = (node.id === selectedId);
      const cardEl = renderNodeCard(node, this.graphStore, {
        isSelected,
        onSelect: (pId) => {
          this.state.selectPerson(pId, true);
        }
      });

      cardEl.addEventListener('mouseenter', () => {
        this.highlightLineage(node.id);
      });
      cardEl.addEventListener('mouseleave', () => {
        this.highlightLineage(this.state.selectedPersonId);
      });

      nodesLayer.appendChild(cardEl);
    }

    this.updateNodeSelection(selectedId);

    // Update scrollbars & minimap
    this.scrollbars.setContentBounds(bounds);
    this.controls.setNodes(nodes);
  }

  updateNodeSelection(selectedPersonId) {
    const allCards = document.querySelectorAll('.node-card');
    for (const card of allCards) {
      const pId = card.getAttribute('data-person-id');
      if (pId === selectedPersonId) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    }
    this.highlightLineage(selectedPersonId);
  }

  highlightLineage(focusPersonId) {
    const lineageSet = this.computeLineageSet(focusPersonId);

    const allCards = document.querySelectorAll('.node-card');
    for (const card of allCards) {
      const pId = card.getAttribute('data-person-id');
      if (focusPersonId && lineageSet.has(pId) && pId !== focusPersonId) {
        card.classList.add('in-lineage');
      } else {
        card.classList.remove('in-lineage');
      }
    }

    const allEdges = document.querySelectorAll('#edges-layer .edge');
    for (const edgeEl of allEdges) {
      let isHighlighted = false;
      if (focusPersonId) {
        const partners = (edgeEl.getAttribute('data-partners') || '').split(',').filter(Boolean);
        const childId = edgeEl.getAttribute('data-child');

        if (childId) {
          if (lineageSet.has(childId) && partners.some(p => lineageSet.has(p))) {
            isHighlighted = true;
          }
        } else if (partners.length >= 2) {
          if (partners.every(p => lineageSet.has(p))) {
            isHighlighted = true;
          }
        }
      }

      if (isHighlighted) {
        edgeEl.classList.add('edge-highlighted');
      } else {
        edgeEl.classList.remove('edge-highlighted');
      }
    }
  }

  centerOnPerson(personId, targetZoom = null) {
    const pos = this.nodePositions.get(personId);
    if (pos) {
      this.viewport.centerAt(pos.x + pos.width / 2, pos.y + pos.height / 2, targetZoom);
    }
  }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new GeneaApp();
  app.init();
});
