// controls.js - Floating toolbar widgets, zoom/pan controls, and minimap radar view

export class ViewportControls {
  /**
   * @param {Object} elements
   * @param {HTMLElement} elements.toolbar
   * @param {HTMLElement} elements.minimapCanvas
   * @param {HTMLElement} elements.minimapViewport
   * @param {SVGViewport} viewport
   * @param {Function} getBoundsCallback
   * @param {Function} getSelectedPersonIdCallback
   * @param {Function} getNodePosCallback
   */
  constructor(elements, viewport, getBoundsCallback, getSelectedPersonIdCallback, getNodePosCallback) {
    this.toolbar = elements.toolbar;
    this.canvas = elements.minimapCanvas;
    this.minimapViewport = elements.minimapViewport;
    this.viewport = viewport;
    this.getBounds = getBoundsCallback;
    this.getSelectedPersonId = getSelectedPersonIdCallback;
    this.getNodePos = getNodePosCallback;

    this.allNodes = [];
    this.isMinimapDragging = false;

    this._bindToolbar();
    this._bindMinimap();
  }

  setNodes(nodes) {
    this.allNodes = nodes;
    this.renderMinimap();
  }

  _bindToolbar() {
    if (!this.toolbar) return;

    // Pan buttons
    const step = 150;
    this.toolbar.querySelector('#btn-pan-up')?.addEventListener('click', () => {
      this.viewport.panBy(0, -step);
    });
    this.toolbar.querySelector('#btn-pan-down')?.addEventListener('click', () => {
      this.viewport.panBy(0, step);
    });
    this.toolbar.querySelector('#btn-pan-left')?.addEventListener('click', () => {
      this.viewport.panBy(-step, 0);
    });
    this.toolbar.querySelector('#btn-pan-right')?.addEventListener('click', () => {
      this.viewport.panBy(step, 0);
    });

    // Zoom buttons
    this.toolbar.querySelector('#btn-zoom-in')?.addEventListener('click', () => {
      this.viewport.zoomBy(1 / 1.2);
    });
    this.toolbar.querySelector('#btn-zoom-out')?.addEventListener('click', () => {
      this.viewport.zoomBy(1.2);
    });

    // Reset zoom
    const zoomResetBtn = this.toolbar.querySelector('#btn-zoom-reset');
    if (zoomResetBtn) {
      zoomResetBtn.addEventListener('click', () => {
        this.viewport.setZoom(1.0);
      });
    }

    // Fit screen
    this.toolbar.querySelector('#btn-fit-screen')?.addEventListener('click', () => {
      const bounds = this.getBounds();
      this.viewport.fitToBox(bounds, 40);
    });

    // Center selected
    this.toolbar.querySelector('#btn-center-selected')?.addEventListener('click', () => {
      const selectedId = this.getSelectedPersonId();
      if (selectedId) {
        const pos = this.getNodePos(selectedId);
        if (pos) {
          this.viewport.centerAt(pos.x + pos.width / 2, pos.y + pos.height / 2);
        }
      }
    });
  }

  _bindMinimap() {
    if (!this.canvas || !this.minimapViewport) return;

    const parent = this.canvas.parentElement;

    const handleMinimapInteraction = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const bounds = this.getBounds();
      const margin = 80;
      const fullMinX = bounds.minX - margin;
      const fullMinY = bounds.minY - margin;
      const fullW = bounds.width + margin * 2;
      const fullH = bounds.height + margin * 2;

      const svgTargetX = fullMinX + (clickX / rect.width) * fullW;
      const svgTargetY = fullMinY + (clickY / rect.height) * fullH;

      this.viewport.centerAt(svgTargetX, svgTargetY);
    };

    parent.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      parent.setPointerCapture(e.pointerId);
      this.isMinimapDragging = true;
      handleMinimapInteraction(e);
    });

    parent.addEventListener('pointermove', (e) => {
      if (this.isMinimapDragging) {
        handleMinimapInteraction(e);
      }
    });

    const endMinimap = (e) => {
      if (this.isMinimapDragging) {
        this.isMinimapDragging = false;
        try { parent.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };
    parent.addEventListener('pointerup', endMinimap);
    parent.addEventListener('pointercancel', endMinimap);
  }

  updateZoomIndicator(zoomLevel) {
    const zoomResetBtn = this.toolbar?.querySelector('#btn-zoom-reset');
    if (zoomResetBtn) {
      zoomResetBtn.textContent = `${Math.round(zoomLevel * 100)}%`;
    }
  }

  renderMinimap() {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const bounds = this.getBounds();
    const margin = 80;
    const fullMinX = bounds.minX - margin;
    const fullMinY = bounds.minY - margin;
    const fullW = Math.max(bounds.width + margin * 2, 1);
    const fullH = Math.max(bounds.height + margin * 2, 1);

    // Draw all node cards as dots/small boxes
    ctx.fillStyle = '#64748b';
    for (const node of this.allNodes) {
      const nx = ((node.x - fullMinX) / fullW) * w;
      const ny = ((node.y - fullMinY) / fullH) * h;
      const nw = Math.max(2, (node.width / fullW) * w);
      const nh = Math.max(2, (node.height / fullH) * h);
      ctx.fillRect(nx, ny, nw, nh);
    }

    this.updateMinimapViewport();
  }

  updateMinimapViewport() {
    if (!this.canvas || !this.minimapViewport) return;

    const w = this.canvas.width;
    const h = this.canvas.height;

    const bounds = this.getBounds();
    const margin = 80;
    const fullMinX = bounds.minX - margin;
    const fullMinY = bounds.minY - margin;
    const fullW = Math.max(bounds.width + margin * 2, 1);
    const fullH = Math.max(bounds.height + margin * 2, 1);

    const vb = this.viewport.viewBox;

    const vx = ((vb.x - fullMinX) / fullW) * w;
    const vy = ((vb.y - fullMinY) / fullH) * h;
    const vw = (vb.w / fullW) * w;
    const vh = (vb.h / fullH) * h;

    this.minimapViewport.style.left = `${Math.max(0, vx)}px`;
    this.minimapViewport.style.top = `${Math.max(0, vy)}px`;
    this.minimapViewport.style.width = `${Math.min(w, vw)}px`;
    this.minimapViewport.style.height = `${Math.min(h, vh)}px`;
  }
}
