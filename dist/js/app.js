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
        this.centerOnPerson(pId);
        this.modal.close();
      }
    });

    // 7. Initialize Application State & Search Router
    this.state = new AppState(this.graphStore, {
      onSelectPerson: (personId, fromHash, openModal = true) => {
        this.updateNodeSelection(personId);
        if (this.state.viewMode === 'hourglass') {
          this.renderTree();
        }
        if (openModal) {
          this.modal.open(personId);
        }
      },
      onViewModeChange: (mode) => {
        this.updateViewModeButtons(mode);
        this.renderTree();
        const selId = this.state.selectedPersonId;
        if (selId) {
          this.centerOnPerson(selId);
        } else {
          this.viewport.fitToBox(this.currentLayout.bounds, 40);
        }
      },
      onFocusUniqueMatch: (personId) => {
        // Section 5.2 & 6.1: Automatic navigation on unique match
        this.state.selectPerson(personId, false);
        this.centerOnPerson(personId);
      }
    });

    // Bind Focus on Person search input
    const searchInput = document.getElementById('focus-person-input');
    const searchResults = document.getElementById('search-results');
    this.state.bindFocusPersonInput(searchInput, searchResults);

    // Bind view mode toggle buttons
    this._bindViewControls();

    // Bind Theme Toggle
    this._bindThemeToggle();

    // 8. Initial Render & Routing
    this.state.initFromHash();
    this.renderTree();

    const initialPersonId = this.state.selectedPersonId;
    if (initialPersonId && this.nodePositions.has(initialPersonId)) {
      this.centerOnPerson(initialPersonId);
    } else if (this.currentLayout) {
      this.viewport.fitToBox(this.currentLayout.bounds, 40);
    }
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

    // Detect user preference
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
    const edgesLayer = document.getElementById('edges-layer');
    const nodesLayer = document.getElementById('nodes-layer');
    clearChildren(edgesLayer);
    clearChildren(nodesLayer);

    // Edges
    for (const edge of edges) {
      const pathEl = createSVG('path', {
        id: edge.id,
        class: `edge edge-${edge.type}`,
        d: edge.d
      });
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
      nodesLayer.appendChild(cardEl);
    }

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
  }

  centerOnPerson(personId) {
    const pos = this.nodePositions.get(personId);
    if (pos) {
      this.viewport.centerAt(pos.x + pos.width / 2, pos.y + pos.height / 2);
    }
  }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new GeneaApp();
  app.init();
});
