class ImageElement {
    constructor(x, y, src) {
        this.x = x;
        this.y = y;
        this.src = src;
        this.image = new Image();
        this.isLoaded = false;
        this.offscreen = null;

        this.image.onload = () => {
            this.isLoaded = true;
            this.offscreen = new OffscreenCanvas(this.image.width, this.image.height);
            this.offscreenCtx = this.offscreen.getContext('2d');
            this.offscreenCtx.drawImage(this.image, 0, 0);
            if (window.canvasApp) {
                window.canvasApp.markEntireCanvasDirty();
            }
        };
        this.image.onerror = () => {
            console.error(`Failed to load image: ${this.src}`);
        };
        this.image.src = src;
    }

    intersectsRegions(regions) {
        if (!regions || !this.isLoaded) return true;
        const bounds = this.getBounds();
        return regions.some(r => this.regionsOverlap(bounds, r));
    }

    getBounds() {
        return {
            x: this.x * window.canvasApp.dpr,
            y: this.y * window.canvasApp.dpr,
            width: this.image.width * window.canvasApp.dpr,
            height: this.image.height * window.canvasApp.dpr
        };
    }

    regionsOverlap(a, b) {
        return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
    }

    render(ctx, regions) {
        if (!this.isLoaded || !this.intersectsRegions(regions)) return;
        ctx.save();
        ctx.drawImage(this.offscreen, this.x, this.y);
        ctx.restore();
    }
}

export { ImageElement };