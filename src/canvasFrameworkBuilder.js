import { LayerManager } from './LayerManager.js';

export class CanvasFrameworkBuilder {
    constructor() {
        this.initCanvas();
        this.setupDefaults();
        this.bindEvents();
        this.layers = [];
        this.viewX = 0;
        this.viewY = 0;
        this.zoom = 1;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.dirtyRegions = [];
        this.fullRedraw = true;
        this.animate = this.animate.bind(this);
        this.handleResize = this.debouncedResize.bind(this);
        this.start();
        console.log("CanvasFrameworkBuilder Initialized with Optimized Rendering");
    }

    initCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'canvasFramework';
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;
        this.bgColor = '#f0f0f0';
        this.updateDimensions();
    }

    setupDefaults() {
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.overflow = 'hidden';
        this.canvas.style.cursor = 'grab';
    }

    updateDimensions() {
        this.physicalWidth = window.innerWidth * this.dpr;
        this.physicalHeight = window.innerHeight * this.dpr;
        this.canvas.width = this.physicalWidth;
        this.canvas.height = this.physicalHeight;
        this.canvas.style.width = `${window.innerWidth}px`;
        this.canvas.style.height = `${window.innerHeight}px`;
        this.markEntireCanvasDirty();
    }

    debouncedResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.updateDimensions();
        }, 100);
    }

    bindEvents() {
        window.addEventListener('resize', this.handleResize);
        this.canvas.addEventListener('mousedown', (e) => this.startDrag(e));
        this.canvas.addEventListener('mousemove', (e) => this.drag(e));
        this.canvas.addEventListener('mouseup', () => this.endDrag());
        this.canvas.addEventListener('mouseleave', () => this.endDrag());
        this.canvas.addEventListener('wheel', (e) => this.zoomView(e), { passive: false });
        this.cleanup = () => {
            window.removeEventListener('resize', this.handleResize);
            console.log("Event Listeners Cleaned Up");
        };
    }

    startDrag(e) {
        this.isDragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
    }

    drag(e) {
        if (!this.isDragging) return;
        const dx = (e.clientX - this.lastX) / this.dpr;
        const dy = (e.clientY - this.lastY) / this.dpr;
        // Mark old view region as dirty
        this.markDirty(this.viewX, this.viewY, window.innerWidth, window.innerHeight);
        this.viewX += dx;
        this.viewY += dy;
        // Mark new view region as dirty
        this.markDirty(this.viewX, this.viewY, window.innerWidth, window.innerHeight);
        this.lastX = e.clientX;
        this.lastY = e.clientY;
    }

    endDrag() {
        if (this.isDragging) {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        }
    }

    zoomView(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1; // 10% steps
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / this.dpr;
        const mouseY = (e.clientY - rect.top) / this.dpr;

        // Mark current view as dirty
        this.markDirty(this.viewX, this.viewY, window.innerWidth, window.innerHeight);

        const worldXBefore = (mouseX - this.viewX) / this.zoom;
        const worldYBefore = (mouseY - this.viewY) / this.zoom;

        this.zoom *= zoomFactor;
        this.zoom = Math.max(0.1, Math.min(this.zoom, 10));

        this.viewX = mouseX - worldXBefore * this.zoom;
        this.viewY = mouseY - worldYBefore * this.zoom;

        // Mark new view as dirty
        this.markDirty(this.viewX, this.viewY, window.innerWidth, window.innerHeight);
    }

    addLayer(layer) {
        if (!(layer instanceof LayerManager)) {
            console.error("Invalid layer provided. Must be an instance of LayerManager.");
            return;
        }
        this.layers.push(layer);
        this.markEntireCanvasDirty();
    }

    markDirty(x, y, width, height) {
        // Convert screen-space coords to canvas space considering transforms
        const zoomedWidth = width / this.zoom;
        const zoomedHeight = height / this.zoom;
        const region = {
            x: (x - this.viewX) * this.dpr,
            y: (y - this.viewY) * this.dpr,
            width: zoomedWidth * this.dpr,
            height: zoomedHeight * this.dpr
        };
        this.dirtyRegions.push(region);
    }

    markEntireCanvasDirty() {
        this.fullRedraw = true;
        this.dirtyRegions = [{ x: 0, y: 0, width: this.physicalWidth, height: this.physicalHeight }];
    }

    mergeRegions(regions) {
        if (regions.length <= 1) return regions;
        let merged = [];
        let currentRegions = [...regions];
        let didMerge;
        do {
            didMerge = false;
            merged = [];
            const processed = new Array(currentRegions.length).fill(false);
            for (let i = 0; i < currentRegions.length; i++) {
                if (processed[i]) continue;
                let base = { ...currentRegions[i] };
                processed[i] = true;
                for (let j = i + 1; j < currentRegions.length; j++) {
                    if (processed[j]) continue;
                    if (this.regionsOverlap(base, currentRegions[j])) {
                        base = this.combineRegions(base, currentRegions[j]);
                        processed[j] = true;
                        didMerge = true;
                    }
                }
                merged.push(base);
            }
            currentRegions = merged;
        } while (didMerge);
        return merged;
    }

    regionsOverlap(a, b) {
        return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
    }

    combineRegions(a, b) {
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        return {
            x,
            y,
            width: Math.max(a.x + a.width, b.x + b.width) - x,
            height: Math.max(a.y + a.height, b.y + b.height) - y
        };
    }

    render() {
        this.ctx.resetTransform();
        this.ctx.scale(this.dpr, this.dpr);

        if (this.fullRedraw) {
            this.ctx.fillStyle = this.bgColor;
            this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
            this.drawLayers();
            this.fullRedraw = false;
        } else if (this.dirtyRegions.length > 0) {
            const mergedRegions = this.mergeRegions(this.dirtyRegions);
            this.ctx.save();
            mergedRegions.forEach(r => this.ctx.clearRect(r.x, r.y, r.width, r.height));
            this.drawLayers(mergedRegions);
            this.ctx.restore();
            this.dirtyRegions = [];
        }
    }

    drawLayers(regions = null) {
        this.ctx.save();
        this.ctx.translate(this.viewX, this.viewY);
        this.ctx.scale(this.zoom, this.zoom);
        for (const layer of this.layers) {
            if (layer.visible) {
                layer.render(this.ctx, regions);
            }
        }
        this.ctx.restore();
    }

    animate() {
        this.render();
        requestAnimationFrame(this.animate);
    }

    start() {
        requestAnimationFrame(this.animate);
    }
}