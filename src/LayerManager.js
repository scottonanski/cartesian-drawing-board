export class LayerManager {
    constructor(id, name, type) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.elements = [];
        this.visible = true;
        this.opacity = 1;
    }

    addElement(element) {
        this.elements.push(element);
    }

    render(ctx, regions = null) {
        if (!this.visible) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;

        if (!regions) {
            // Full redraw: render all elements
            for (const element of this.elements) {
                element.render(ctx, regions);
            }
        } else {
            // Dirty regions: render only overlapping elements
            for (const element of this.elements) {
                if (element.intersectsRegions(regions)) {
                    element.render(ctx, regions);
                }
            }
        }

        ctx.restore();
    }
}