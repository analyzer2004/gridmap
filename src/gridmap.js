// https://github.com/analyzer2004/gridmap
// Copyright 2020 Eric Lo
class GridMap {
    constructor(container) {
        this._container = container;
        this._g = null;

        this._width = 800;
        this._height = 600;
        this._style = {
            transition: false,
            shape: "square",
            sizeByValue: false,
            cr: 4,
            defaultCellColor: "#999",
            defaultTextColor: "white",
            shortFormat: ".2s",
            longFormat: ",.0d",
            legendFormat: ",.0d",
            legendTitle: "",
            showOverlay: true,
            showOverlayLegend: true,
            alwaysShowOverlay: false,
            hideCell: false,
            overlayLegendThreshold: 14,
            showMapLegend: true
        };
        this._cellPalette = d3.interpolateYlGnBu;
        this._textPalette = d3.interpolateCubehelixDefault;
        this._overlayPalette = d3.schemeTableau10;

        this._gridData = null;
        this._cols = 0;
        this._rows = 0;
        this._x = null;
        this._y = null;
        this._bandwidth = { x: 0, y: 0, hx: 0, hy: 0 };

        this._data = null;
        this._chartData = null;
        this._field = {
            code: "code",
            name: "state",
            values: [],
            total: ""
        };

        this._contains = { data: true, values: true };        

        this._c = null; // cell color scale
        this._t = null; // text color scale
        this._ov = null; // overlay mini chart color scale
        this._fullOpacity = 1;
        this._showLabel = true;

        this._initDuration = 500;
        this._miniLegend = null;
        this._mapLegend = null;        

        this._customSquareOverlay = null;
        this._customCircleOverlay = null;

        this._uniqueId = new String(Date.now() * Math.random()).replace(".", "");
    }

    size(_) {
        return arguments.length ? (this._width = _[0], this._height = _[1], this) : [this._width, this._height];
    }

    style(_) {
        return arguments.length ? (this._style = Object.assign(this._style, _), this) : this._style;
    }

    cellPalette(_) {
        return arguments.length ? (this._cellPalette = _, this) : this._cellPalette;
    }

    overlayPalette(_) {
        return arguments.length ? (this._overlayPalette = _, this) : this._overlayPalette;
    }

    mapGrid(_) {
        return arguments.length ? (this._gridData = _, this) : this._gridData;
    }

    data(_) {
        return arguments.length ? (this._data = _, this) : this._data;
    }

    field(_) {
        return arguments.length ? (this._field = Object.assign(this._field, _), this) : this._field;
    }

    customSquareOverlay(_) {
        return arguments.length ? (this._customSquareOverlay = _, this) : this._customSquareOverlay;
    }

    customCircleOverlay(_) {
        return arguments.length ? (this._customCircleOverlay = _, this) : this._customCircleOverlay;
    }

    get unitSize() {
        const style = this._style, bandwidth = this._bandwidth;
        const unit = Math.min(bandwidth.x, bandwidth.y);
        return style.sizeByValue ? unit / 2 : unit / (style.shape === "circle" ? 2 : 1);
    }

    render() {
        this._init();
        this._process();
        this._initColors();

        this._g = this._container.append("g");
        this._renderMap();        
    }

    processMap() {
        this._gridData = this._gridData.filter(d => d.code !== "");

        this._cols = d3.max(this._gridData.map(d => d.col)) + 1;
        this._rows = d3.max(this._gridData.map(d => d.row)) + 1;

        this._x = d3.scaleBand()
            .domain(this._seq(this._cols))
            .padding(0.05);

        this._y = d3.scaleBand()
            .domain(this._seq(this._rows))
            .padding(0.05);

        const top = this._style.showMapLegend ? 50 : 0;
        if (this._width / this._cols < this._height / this._rows) {
            this._x.range([0, this._width - top]);
            this._y.range([top, this._width / this._cols * this._rows]);
        }
        else {
            this._x.range([0, this._height / this._rows * this._cols - top]);
            this._y.range([top, this._height]);
        }

        this._bandwidth = {
            x: this._x.bandwidth(),
            y: this._y.bandwidth(),
            hx: this._x.bandwidth() / 2,
            hy: this._y.bandwidth() / 2
        };

        return this;
    }

    _init() {        
        this._contains.data = this._data && this._data.length > 0;
        this._contains.values = this._field.values && this._field.values.length > 0;

        if (!this._contains.data) {
            this._style.showMapLegend = false;
            this._style.sizeByValue = false;
            this._style.showOverlay = false;
            this._style.showOverlayLegend = false;
        }
        else if (!this._contains.values) {
            this._style.showOverlay = false;
            this._style.showOverlayLegend = false;
        }
    }

    _process() {
        this.processMap();
        if (this._data && this._data.length > 0) this._processData();
    }

    _processData() {
        const field = this._field;

        this._showLabel = false;
        this._chartData = this._gridData.map(d => {            
            const datum = this._data.find(_ => _[field.code] === d.code);
            const values = datum && this._contains.values ? field.values.map(vname => datum[vname]) : [];
            const r = {
                col: d.col,
                row: d.row,
                code: d.code,
                state: datum ? datum[field.name] : null,
                values: values,
                total: 0
            };

            if (r.state && r.state !== "") this._showLabel = true;

            if (datum) {
                if (field.total !== "")
                    r.total = datum[field.total];
                else if (values)
                    r.total = values.reduce((a, b) => a + b);
            }

            return r;
        })
    }

    _initColors() {
        if (this._chartData) {
            const ext = d3.extent(this._chartData.map(d => d.total));
            this._c = d3.scaleSequential(this._cellPalette).domain(ext);
            this._t = d3.scaleSequential(this._textPalette).domain(ext);
            if (this._contains.values) this._ov = d3.scaleOrdinal(this._overlayPalette).domain(this._seq(this._field.values.length));
        }
    }

    _renderMap() {
        const style = this._style;

        d3.select("body")
            .append("style")
            .html(`
                ._overlay_${this._uniqueId} { opacity: 0 }
                .overlay_${this._uniqueId} {opacity:${style.alwaysShowOverlay ? 1 : 0}} 
                .overlay_${this._uniqueId}:hover {opacity:1}`
            );

        this._fullOpacity = style.sizeByValue ? 0.9 : 1;

        const cells = this._renderBase().call(g => this._renderShape(g));
        
        if (style.transition) {
            const b = this._initDuration / this._cols;
            cells.transition().duration(d => d.col * b)
                .ease(d3.easeBounce)
                .attr("opacity", this._fullOpacity)
                .attr("transform", d => `translate(${this._x(d.col)},${this._y(d.row)})`)
                // avoid interfering with the initial transition by delaying to attach mouse events                
                .transition().delay(this._initDuration)
                .on("end", () => { this._attachEvents(cells); });
        }
        else 
            this._attachEvents(cells);

        this._miniLegend = this._container
            .append("g")
            .style("font-weight", "bold")
            .style("visibliity", "hidden");

        if (style.showMapLegend && this._chartData) this._addMapLegend(cells);
    }

    _renderBase() {
        var data;
        if (this._chartData)            
            data = this._style.sizeByValue ? this._pack() : this._chartData;
        else
            data = this._gridData;

        const cells = this._g.selectAll("g")
            .data(data)
            .join("g")
            .attr("text-anchor", "middle")
            .attr("opacity", this._style.transition ? 0 : this._fullOpacity)
            .attr("fill", d => d.total ? this._c(d.total) : d.code ? this._style.defaultCellColor : "none");

        if (this._style.transition)
            cells.attr("transform", d => `translate(${-this._bandwidth.x},${this._y(d.row)})`);
        else
            cells.attr("transform", d => `translate(${this._x(d.col)},${this._y(d.row)})`);

        return cells;
    }

    _renderShape(g) {
        const defaultSize = this.unitSize;
        if (this._style.shape === "square")
            this._renderSquares(g, defaultSize)
        else
            this._renderCircles(g, defaultSize);
    }

    _renderSquares(g, size) {
        const style = this._style, bandwidth = this._bandwidth;

        const drawRect = g => {
            const rect = g.append("rect")
                .attr("rx", style.cr).attr("ry", style.cr);

            if (style.sizeByValue) {
                rect.attr("x", d => -d.r + size)
                    .attr("y", d => -d.r + size)
                    .attr("width", d => d.r * 2)
                    .attr("height", d => d.r * 2);
            }
            else {
                rect.attr("width", size)
                    .attr("height", size);
            }

            return rect;
        }

        if (!style.hideCell) {
            drawRect(g);
            this._addCellText(g, true, "ctext");
        }

        const og = g.filter(d => d.total)
            .append("g")
            .attr("class", `_overlay_${this._uniqueId}`)
            .attr("transform", d => style.sizeByValue ? `translate(${-(d.r - size)},${-(d.r - size)})` : "")
            .call(g => drawRect(g).attr("opacity", 0)) // hidden layer for hovering
            .call(g => g.append("g")
                .attr("font-weight", "bold")
                .attr("transform", d => style.sizeByValue ?
                    `translate(${d.r - size},${d.r * 2 - size + 15})` :
                    `translate(0,${bandwidth.hx + 15})`)
                .call(g => {
                    if (style.alwaysShowOverlay)
                        this._addCellText(g, false, "ltext", 0);
                    else
                        this._addCellText(g);
                }));

        if (style.showOverlay) {
            if (this._customSquareOverlay) {
                og.call(g => {
                    const getSize = style.sizeByValue ? d => d.r * 2 : d => size;
                    this._customSquareOverlay(g, getSize, this._ov);
                });
            }
            else {
                og.append("g")
                    .selectAll("rect")
                    .data(d => this._treemap(d))
                    .join("rect")                    
                    .attr("x", d => d.x0).attr("y", d => d.y0)
                    .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
                    //.attr("fill", (d, i) => this._ov(this._field.values[i]))
                    .attr("fill", (d, i) => this._ov(i))
                    .call(g => g.append("title")
                        .text((d, i) => {
                            const val = d.parent ? d.parent.data.children[i] : 0,
                                p = d.parent ? (val / d.parent.value * 100).toFixed(1) : 0;
                            return `${this._field.values[i]}\n${d3.format(this._style.legendFormat)(val)} (${p}%)`;
                        }));
            }
        }
    }

    _renderCircles(g, size) {
        const style = this._style, bandwidth = this._bandwidth;

        const drawCircle = (g, shift) => {
            const circle = g.append("circle")
                .attr("cx", size - shift ? 0 : bandwidth.hx).attr("cy", size - shift ? 0 : bandwidth.hy);

            if (style.sizeByValue)
                circle.attr("r", d => d.r);
            else
                circle.attr("r", d => size);

            return circle;
        }

        if (!style.hideCell) {
            drawCircle(g);
            this._addCellText(g, true, "ctext");
        }

        const og = g.filter(d => d.total)
            .append("g")
            .attr("class", `_overlay_${this._uniqueId}`)
            .attr("transform", `translate(${bandwidth.hx},${bandwidth.hy})`)
            .call(g => drawCircle(g, true).attr("opacity", 0)) // hidden layer for hovering
            .call(g => g.append("g")
                .attr("font-weight", "bold")
                .attr("transform", d => style.sizeByValue ?
                    `translate(${-bandwidth.hx},${d.r - bandwidth.hy + 15})` :
                    `translate(${-bandwidth.hx},${size - bandwidth.hy + 15})`)
                .call(g => {
                    if (style.alwaysShowOverlay)
                        this._addCellText(g, false, "ltext", 0);
                    else
                        this._addCellText(g);
                }));

        if (this._style.showOverlay) {
            if (this._customCircleOverlay) {
                og.call(g => {
                    const getSize = style.sizeByValue ? d => d.r * 2 : d => size;
                    this._customCircleOverlay(g, getSize, this._ov);
                });
            }
            else {
                og.append("g")
                    .selectAll("path")
                    .data(d => d3.pie()(d.values).map(p => ({ pie: p, data: d })))
                    .join("path")
                    .attr("class", "mini")
                    //.attr("fill", (d, i) => this._ov(this._field.values[i]))
                    .attr("fill", (d, i) => this._ov(i))
                    .attr("d", d => d3.arc()
                        .innerRadius(0)
                        .outerRadius(style.sizeByValue ? d.data.r : size)
                        .startAngle(d.pie.startAngle)
                        .endAngle(d.pie.endAngle)())
                    .call(g => g.append("title")
                        .text((d, i) => {
                            const val = d.data.values[i], p = (val / d.data.total * 100).toFixed(1);
                            return `${this._field.values[i]}\n${d3.format(this._style.legendFormat)(val)} (${p}%)`;
                        }));
            }
        }
    }

    _addCellText(g, short, className, opacity) {
        const tg = g.append("g")
            .attr("class", className)
            .attr("opacity", opacity)
            .attr("fill", d => d.total ? short ? this._t(d.total) : "black" : this._style.defaultTextColor)
            .attr("transform", `translate(${this._bandwidth.hx},${this._bandwidth.hy})`);

        if (short || this._showLabel) tg.call(g => g.append("text").text(d => short ? d.code : d.state));
        tg.call(g => g.append("text")
            .attr("dy", short || this._showLabel ? "1em" : "")
            .text(d => d.total ? d3.format(short ? this._style.shortFormat : this._style.longFormat)(d.total) : "---"));
    }

    _attachEvents(cells) {
        cells
            .on("mouseenter", (e, d) => {
                e.currentTarget.parentElement.appendChild(e.currentTarget);
                cells.transition().duration(500)
                    .attr("opacity", a => a === d ? 1 : 0.4);
                    //.selectAll(".ctext").attr("opacity", 0.3);                

                if (this._style.alwaysShowOverlay)
                    cells.selectAll(".ltext").attr("opacity", a => a === d ? 1 : 0);
                    
                if (d.total && d.values) this._showLegend(d);
            })
            .on("mouseleave", (e, d) => {
                cells.transition().duration(500)
                    .attr("opacity", this._fullOpacity);                    
                    //.selectAll(".ctext").attr("opacity", 1);                

                if (this._style.alwaysShowOverlay)
                    cells.selectAll(".ltext").attr("opacity", 0);

                this._miniLegend.style("visibility", "hidden");
            });
        cells.selectAll(`._overlay_${this._uniqueId}`).attr("class", `overlay_${this._uniqueId}`);
    }

    _showLegend(d) {
        const style = this._style, bandwidth = this._bandwidth;

        if (!style.showOverlay || this._field.values.length > style.overlayLegendThreshold) return;

        const w = 20, h = 12;
        var r, left, top;
        if (style.sizeByValue) {
            r = d.r;
            left = this._x(d.col) + bandwidth.x + 10 + (d.r - bandwidth.hx);
            top = this._y(d.row);
        }
        else {
            r = bandwidth.hx;
            left = this._x(d.col) + bandwidth.x + 10;
            top = this._y(d.row);
        }

        const getText = (_, i) => {
            const val = d.values[i], p = (val / d.total * 100).toFixed(1);
            return `${this._field.values[i]} ${d3.format(style.legendFormat)(val)}(${p}%)`;
        };

        this._miniLegend
            .attr("transform", `translate(${left},${top})`)
            .selectAll("g")
            .data(this._field.values.slice(0, style.overlayLegendThreshold))
            .join(
                enter => {                    
                    return enter.append("g")
                        .attr("transform", (_, i) => `translate(0,${(h + 5) * i})`)
                        .call(g => g.append("rect")
                            .attr("rx", 4).attr("ry", 4)
                            .attr("width", w).attr("height", h)
                            //.attr("fill", (d, i) => this._ov(this._field.values[i])))
                            .attr("fill", (d, i) => this._ov(i)))
                        .call(g => g.append("text")
                            .attr("dy", "0.8em")
                            .attr("transform", `translate(${w + 5},0)`)
                            .text(getText))                    
                },
                update => update.select("text").text(getText),
                exit => exit.remove());

        this._miniLegend.node().parentElement.appendChild(this._miniLegend.style("visibility", "visible").node());
        const bbox = this._miniLegend.node().getBBox();
        if (left + bbox.width > this._width)
            this._miniLegend.attr(
                "transform",
                `translate(${this._x(d.col) + bandwidth.hx - bbox.width - r - 10},${top})`);
    }

    _addMapLegend(cells) {
        this._mapLegend = this._container.append("g")
            .style("visibility", this._style.transition ? "hidden" : "visible")
            .call(g => this._renderLegend(g)
                .on("mouseover", (e, d) =>
                    cells.filter(c => c.total < d.floor || c.total >= d.ceiling)
                        .transition().duration(500)
                        .attr("opacity", 0.2))
                .on("mouseout", () => cells.transition().duration(500).attr("opacity", 1)));

        // avoid interfering with the initial transition
        if (this._style.transition) {
            this._mapLegend
                .transition().delay(this._initDuration)
                .style("visibility", "visible");
        }
    }

    _renderLegend(g) {
        const w = 30;
        const s = sample(d3.extent(this._chartData.map(d => d.total).filter(d => d !== 0)), 8);

        if (s.length > 0) {
            g.attr("font-weight", "bold")
                .append("text")
                .attr("text-anchor", "end")
                .attr("alignment-baseline", "hanging")
                .attr("transform", `translate(${w * 9},0)`)
                .text(this._style.legendTitle);
        }

        return g.selectAll("g")
            .data(s)
            .join("g")
            .attr("font-size", "8pt")
            .attr("transform", (d, i) => `translate(${i * w},0)`)
            .call(g => g.append("rect")
                .attr("y", "1.2em")
                .attr("fill", d => this._c(d.floor))
                .attr("width", w).attr("height", "1.5em"))
            .call(g => g.append("text")
                .attr("dy", "3.7em")
                .text(d => d3.format(this._style.shortFormat)(d.floor)));

        function sample(ext, segs) {
            const min = ext[0], max = ext[1];
            const gap = (max - min) / segs;

            if (gap === 0) return [];

            var curr = { floor: min, ceiling: 0 };
            const s = [curr];
            for (var i = min + gap; i <= max - gap; i += gap) {
                const p = Math.pow(10, Math.round(i).toString().length - 2);
                const v = Math.floor(i / p) * p;
                curr.ceiling = v;
                curr = { floor: v, ceiling: 0 };
                s.push(curr);
            }
            curr.ceiling = max;
            s.push({ floor: max, ceiling: Number.MAX_VALUE });
            return s;
        }
    }

    _pack() {
        return d3.pack()
            .size([this._width, this._height])(
                d3.hierarchy({ children: this._chartData })
                    .sum(d => d.total))
            .leaves()
            .map(d => Object.assign(d, d.data));
    }

    _treemap(d) {
        const size = this._style.sizeByValue ? [d.r * 2, d.r * 2] : [this._bandwidth.x, this._bandwidth.y];
        return d3.treemap()
            .size(size)
            (d3.hierarchy({ children: d.values }).sum(d => d))
            .leaves();
    }

    _seq(length) {
        const a = new Array(length);
        for (let i = 0; i < length; i++) a[i] = i;
        return a;
    }
}