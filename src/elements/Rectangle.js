class Rectangle {
    constructor(x, y, width, height, fillColor) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.fillColor = fillColor;
    }

    intersectsRegions(regions) {
        if (!regions) return true;
        const bounds = this.getBounds();
        return regions.some(r => this.regionsOverlap(bounds, r));
    }

    getBounds() {
        return {
            x: this.x * window.canvasApp.dpr,
            y: this.y * window.canvasApp.dpr,
            width: this.width * window.canvasApp.dpr,
            height: this.height * window.canvasApp.dpr
        };
    }

    regionsOverlap(a, b) {
        return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
    }

    render(ctx, regions) {
        if (!this.intersectsRegions(regions)) return;
        ctx.save();
        ctx.fillStyle = this.fillColor;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}

export { Rectangle };