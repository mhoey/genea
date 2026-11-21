// svg-viewport.js - High-performance SVG viewBox pan, zoom, and pointer interaction engine

export class SVGViewport {
  /**
   * @param {SVGSVGElement} svgElement
   * @param {Object} [options]
   * @param {Function} [options.onViewportChange]
   */
  constructor(svgElement, options = {}) {
    this.svg = svgElement;
    this.onViewportChange = options.onViewportChange || (() => {});

    // Internal viewBox state
    this.viewBox = {
      x: 0,
      y: 0,
      w: 1200,
      h: 800
    };

    this.minZoom = 0.1;
    this.maxZoom = 3.0;
    this.initialScale = 1.0;

    // Pointer drag state
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.viewBoxStart = { x: 0, y: 0 };

    // Pinch zoom state
    this.activePointers = new Map();
    this.initialPinchDistance = null;
    this.initialPinchViewBox = null;

    this._bindEvents();
    this.updateViewBox();
  }

  _bindEvents() {
    // Pointer down (start pan or pinch)
    this.svg.addEventListener('pointerdown', (e) => {
      // Ignore if clicking directly on a node card button or modal
      if (e.target.closest('.node-card')) return;

      this.svg.setPointerCapture(e.pointerId);
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size === 1) {
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.viewBoxStart = { x: this.viewBox.x, y: this.viewBox.y };
        this.svg.classList.add('panning');
      } else if (this.activePointers.size === 2) {
        this.isDragging = false;
        const pts = Array.from(this.activePointers.values());
        this.initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        this.initialPinchViewBox = { ...this.viewBox };
      }
    });

    // Pointer move (pan or pinch)
    this.svg.addEventListener('pointermove', (e) => {
      if (!this.activePointers.has(e.pointerId)) return;
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size === 1 && this.isDragging) {
        const rect = this.svg.getBoundingClientRect();
        const scaleX = this.viewBox.w / rect.width;
        const scaleY = this.viewBox.h / rect.height;

        const dx = (e.clientX - this.dragStart.x) * scaleX;
        const dy = (e.clientY - this.dragStart.y) * scaleY;

        this.viewBox.x = this.viewBoxStart.x - dx;
        this.viewBox.y = this.viewBoxStart.y - dy;
        this.updateViewBox();
      } else if (this.activePointers.size === 2 && this.initialPinchDistance) {
        const pts = Array.from(this.activePointers.values());
        const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (currentDist > 10 && this.initialPinchDistance > 10) {
          const factor = this.initialPinchDistance / currentDist;
          this.viewBox.w = this.initialPinchViewBox.w * factor;
          this.viewBox.h = this.initialPinchViewBox.h * factor;
          this.updateViewBox();
        }
      }
    });

    // Pointer up & cancel
    const endDrag = (e) => {
      if (this.activePointers.has(e.pointerId)) {
        this.activePointers.delete(e.pointerId);
        try {
          this.svg.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }

      if (this.activePointers.size === 0) {
        this.isDragging = false;
        this.initialPinchDistance = null;
        this.initialPinchViewBox = null;
        this.svg.classList.remove('panning');
      } else if (this.activePointers.size === 1) {
        // Switch back to single pointer drag
        const [remainingPt] = Array.from(this.activePointers.values());
        this.isDragging = true;
        this.dragStart = { x: remainingPt.x, y: remainingPt.y };
        this.viewBoxStart = { x: this.viewBox.x, y: this.viewBox.y };
      }
    };

    this.svg.addEventListener('pointerup', endDrag);
    this.svg.addEventListener('pointercancel', endDrag);

    // Mouse wheel zoom centered on cursor
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();

      const rect = this.svg.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      // Coordinate in current SVG viewBox
      const svgX = this.viewBox.x + (cursorX / rect.width) * this.viewBox.w;
      const svgY = this.viewBox.y + (cursorY / rect.height) * this.viewBox.h;

      const zoomFactor = e.deltaY > 0 ? 1.15 : (1 / 1.15);
      this.zoomAtPoint(svgX, svgY, zoomFactor);
    }, { passive: false });

    // Window resize handler
    window.addEventListener('resize', () => {
      this.updateViewBox();
    });
  }

  updateViewBox() {
    this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);
    this.onViewportChange({
      x: this.viewBox.x,
      y: this.viewBox.y,
      w: this.viewBox.w,
      h: this.viewBox.h,
      zoom: this.getZoomLevel()
    });
  }

  getZoomLevel() {
    const rect = this.svg.getBoundingClientRect();
    if (!rect.width) return 1.0;
    return (rect.width / this.viewBox.w);
  }

  zoomAtPoint(svgX, svgY, factor) {
    const rect = this.svg.getBoundingClientRect();
    const currentZoom = rect.width / this.viewBox.w;
    const targetZoom = currentZoom / factor;

    if (targetZoom < this.minZoom || targetZoom > this.maxZoom) {
      return;
    }

    const newW = this.viewBox.w * factor;
    const newH = this.viewBox.h * factor;

    // Keep svgX and svgY fixed under cursor
    const ratioX = (svgX - this.viewBox.x) / this.viewBox.w;
    const ratioY = (svgY - this.viewBox.y) / this.viewBox.h;

    this.viewBox.x = svgX - ratioX * newW;
    this.viewBox.y = svgY - ratioY * newH;
    this.viewBox.w = newW;
    this.viewBox.h = newH;

    this.updateViewBox();
  }

  zoomBy(factor) {
    const centerX = this.viewBox.x + this.viewBox.w / 2;
    const centerY = this.viewBox.y + this.viewBox.h / 2;
    this.zoomAtPoint(centerX, centerY, factor);
  }

  panBy(dx, dy) {
    this.viewBox.x += dx;
    this.viewBox.y += dy;
    this.updateViewBox();
  }

  setZoom(targetZoom) {
    const clamped = Math.max(this.minZoom, Math.min(this.maxZoom, targetZoom));
    const rect = this.svg.getBoundingClientRect();
    const currentW = this.viewBox.w;
    const newW = rect.width / clamped;
    const factor = newW / currentW;
    this.zoomBy(factor);
  }

  centerAt(x, y, zoom = null) {
    const rect = this.svg.getBoundingClientRect();
    if (zoom !== null) {
      const clamped = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
      this.viewBox.w = rect.width / clamped;
      this.viewBox.h = rect.height / clamped;
    }
    this.viewBox.x = x - this.viewBox.w / 2;
    this.viewBox.y = y - this.viewBox.h / 2;
    this.updateViewBox();
  }

  fitToBox(box, margin = 40) {
    const rect = this.svg.getBoundingClientRect();
    const boxW = (box.width || 800) + margin * 2;
    const boxH = (box.height || 600) + margin * 2;

    const scaleX = rect.width / boxW;
    const scaleY = rect.height / boxH;
    const fitScale = Math.min(scaleX, scaleY, 1.2); // don't over-zoom small trees

    this.viewBox.w = rect.width / fitScale;
    this.viewBox.h = rect.height / fitScale;
    this.viewBox.x = (box.minX - margin) + (boxW - this.viewBox.w) / 2;
    this.viewBox.y = (box.minY - margin) + (boxH - this.viewBox.h) / 2;

    this.updateViewBox();
  }

  getViewBox() {
    return { ...this.viewBox };
  }
}
