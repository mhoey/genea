// scrollbars.js - Synchronized virtual scrollbars for horizontal and vertical panning

export class SynchronizedScrollbars {
  /**
   * @param {Object} elements
   * @param {HTMLElement} elements.trackH - Horizontal scrollbar track element
   * @param {HTMLElement} elements.thumbH - Horizontal scrollbar thumb element
   * @param {HTMLElement} elements.trackV - Vertical scrollbar track element
   * @param {HTMLElement} elements.thumbV - Vertical scrollbar thumb element
   * @param {SVGViewport} viewport - SVGViewport instance
   */
  constructor(elements, viewport) {
    this.trackH = elements.trackH;
    this.thumbH = elements.thumbH;
    this.trackV = elements.trackV;
    this.thumbV = elements.thumbV;
    this.viewport = viewport;

    this.contentBounds = { minX: 0, minY: 0, maxX: 1200, maxY: 800 };
    this.isDraggingH = false;
    this.isDraggingV = false;
    this.dragStartPos = 0;
    this.dragStartViewBoxPos = 0;

    this._bindEvents();
  }

  setContentBounds(bounds) {
    this.contentBounds = { ...bounds };
    this.update();
  }

  _bindEvents() {
    if (!this.trackH || !this.thumbH || !this.trackV || !this.thumbV) return;

    // Horizontal thumb drag
    this.thumbH.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.thumbH.setPointerCapture(e.pointerId);
      this.isDraggingH = true;
      this.dragStartPos = e.clientX;
      this.dragStartViewBoxPos = this.viewport.viewBox.x;
    });

    this.thumbH.addEventListener('pointermove', (e) => {
      if (!this.isDraggingH) return;
      const trackWidth = this.trackH.clientWidth;
      const totalSpanX = Math.max(this.contentBounds.maxX - this.contentBounds.minX, this.viewport.viewBox.w * 1.5);
      const deltaScreenX = e.clientX - this.dragStartPos;
      const deltaSvgX = (deltaScreenX / trackWidth) * totalSpanX;

      this.viewport.viewBox.x = this.dragStartViewBoxPos + deltaSvgX;
      this.viewport.updateViewBox();
    });

    const endH = (e) => {
      if (this.isDraggingH) {
        this.isDraggingH = false;
        try { this.thumbH.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };
    this.thumbH.addEventListener('pointerup', endH);
    this.thumbH.addEventListener('pointercancel', endH);

    // Track H click
    this.trackH.addEventListener('click', (e) => {
      if (e.target === this.thumbH) return;
      const rect = this.trackH.getBoundingClientRect();
      const clickRatio = (e.clientX - rect.left) / rect.width;
      const totalSpanX = Math.max(this.contentBounds.maxX - this.contentBounds.minX, this.viewport.viewBox.w * 1.5);
      const minX = Math.min(this.contentBounds.minX, this.viewport.viewBox.x);
      this.viewport.viewBox.x = minX + clickRatio * totalSpanX - this.viewport.viewBox.w / 2;
      this.viewport.updateViewBox();
    });

    // Vertical thumb drag
    this.thumbV.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.thumbV.setPointerCapture(e.pointerId);
      this.isDraggingV = true;
      this.dragStartPos = e.clientY;
      this.dragStartViewBoxPos = this.viewport.viewBox.y;
    });

    this.thumbV.addEventListener('pointermove', (e) => {
      if (!this.isDraggingV) return;
      const trackHeight = this.trackV.clientHeight;
      const totalSpanY = Math.max(this.contentBounds.maxY - this.contentBounds.minY, this.viewport.viewBox.h * 1.5);
      const deltaScreenY = e.clientY - this.dragStartPos;
      const deltaSvgY = (deltaScreenY / trackHeight) * totalSpanY;

      this.viewport.viewBox.y = this.dragStartViewBoxPos + deltaSvgY;
      this.viewport.updateViewBox();
    });

    const endV = (e) => {
      if (this.isDraggingV) {
        this.isDraggingV = false;
        try { this.thumbV.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };
    this.thumbV.addEventListener('pointerup', endV);
    this.thumbV.addEventListener('pointercancel', endV);

    // Track V click
    this.trackV.addEventListener('click', (e) => {
      if (e.target === this.thumbV) return;
      const rect = this.trackV.getBoundingClientRect();
      const clickRatio = (e.clientY - rect.top) / rect.height;
      const totalSpanY = Math.max(this.contentBounds.maxY - this.contentBounds.minY, this.viewport.viewBox.h * 1.5);
      const minY = Math.min(this.contentBounds.minY, this.viewport.viewBox.y);
      this.viewport.viewBox.y = minY + clickRatio * totalSpanY - this.viewport.viewBox.h / 2;
      this.viewport.updateViewBox();
    });
  }

  update() {
    if (!this.trackH || !this.thumbH || !this.trackV || !this.thumbV) return;

    const vb = this.viewport.viewBox;

    // Horizontal bounds
    const minX = Math.min(this.contentBounds.minX - 100, vb.x);
    const maxX = Math.max(this.contentBounds.maxX + 100, vb.x + vb.w);
    const totalSpanX = Math.max(maxX - minX, 1);

    const trackWidth = this.trackH.clientWidth;
    const thumbWidthRatio = Math.min(1.0, Math.max(0.05, vb.w / totalSpanX));
    const thumbWidthPx = Math.max(24, trackWidth * thumbWidthRatio);

    const posRatioX = Math.max(0, Math.min(1.0 - thumbWidthRatio, (vb.x - minX) / totalSpanX));
    const thumbLeftPx = posRatioX * trackWidth;

    this.thumbH.style.width = `${thumbWidthPx}px`;
    this.thumbH.style.transform = `translateX(${thumbLeftPx}px)`;

    // Vertical bounds
    const minY = Math.min(this.contentBounds.minY - 100, vb.y);
    const maxY = Math.max(this.contentBounds.maxY + 100, vb.y + vb.h);
    const totalSpanY = Math.max(maxY - minY, 1);

    const trackHeight = this.trackV.clientHeight;
    const thumbHeightRatio = Math.min(1.0, Math.max(0.05, vb.h / totalSpanY));
    const thumbHeightPx = Math.max(24, trackHeight * thumbHeightRatio);

    const posRatioY = Math.max(0, Math.min(1.0 - thumbHeightRatio, (vb.y - minY) / totalSpanY));
    const thumbTopPx = posRatioY * trackHeight;

    this.thumbV.style.height = `${thumbHeightPx}px`;
    this.thumbV.style.transform = `translateY(${thumbTopPx}px)`;
  }
}
