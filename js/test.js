// Setup
// var width = 1000;x
// var height = 1000;
var width = window.innerWidth;
var height = window.innerHeight;
var data;
var force, drag, zoom;
var nodeColorScale;
var nodeRadiusScale;
var linkWeightScale;
var nodesDegDim, edgesWeightDim, junctionsWeightDim;
var nodesConDim, edgesConDim;
var nodes = [];
var links = [];
var linked = {};
var node, link, nodeLayer, linkLayer, container;
var svg;
var ndegVal = 2, 
    wminVal = 3,
    jminVal = 2;
var highlightId = -1;
var showArrow = 0,
    showJunctions = 1,
    showSynapses = 1;
var fetched = false;
var arcs = true;
var sqrt3 = 1.7320508075688772;

//-------------------------------------------------------------------
// Grap with d3
//-------------------------------------------------------------------

graph = function(id, d) {
    data = d;

    // Containers
    svg = d3.select(id).append("svg")
        .attr("viewBox", "0 0 " + width + " " + height)
        .attr("preserveAspectRatio", "xMidYMid meet");

    container = svg.append("g").attr("style", "cursor:move");
    linkLayer = container.append("g");
    nodeLayer = container.append("g");
    
    var degreeDomain = d3.extent(data.neurons, function(n) { return n.D; });
    nodeRadiusScale = d3.scale.linear().domain(degreeDomain).range([10,25]);

    var weightDomain = d3.extent(data.synapses, function(s) { return s.weight; });
    linkWeightScale = d3.scale.linear().domain(weightDomain).range([2,6]);

    initNodePos(data.neurons);
    addNodeRadius(data.neurons);

    colors = ["#00ADEF", "#ED008C", "#F5892D", "#afddca", "#f2b1ff", "#ff8cbd", "#bbb"];

    // Build arrows
    svg.append("svg:defs").selectAll("marker").data(colors)      // Different link/path types can be defined here
      .enter().append("svg:marker")    // This section adds in the arrows
        .attr("id", String)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 10)
        .attr("refY", -0)
        .attr("markerWidth", 8)
        .attr("markerHeight", 8)
        .attr("markerUnits", "userSpaceOnUse")
        .attr("orient", "auto")
        .attr("style", function(d) { return "fill: " + d + "; visibility: hidden;"})
            .append("svg:path")
                .attr("d", "M0,-5L10,0L0,5");

    // Create force layout
    force = d3.layout.force()
        .nodes(nodes)
        .links(links)
        .charge(-250)
        .linkDistance(120)
        .linkStrength(0.9)
        .friction(0.5)
        .gravity(0.3)
        .size([width, height])
        .on("tick", tick);

    drag = force.drag().on("dragstart", dragstarted).on("drag", dragged);
    zoom = d3.behavior.zoom().scaleExtent([0.75, 2]).on("zoom", zoomed); 
    svg.call(zoom).on("dblclick.zoom", null);

    node = nodeLayer.selectAll(".node");
    link = linkLayer.selectAll(".link");  

    svg.on("click", function() {
        toggleSelected(highlightId, false);
        connectedNodes(null);
        highlightId = -1;
        d3.event.stopPropagation();
    });  

    // Crossfilter
   
    update(data.neurons, data.synapses);
    
    // Warm-start
    for (i = 0; i < 10; i++)
        force.tick();

}

function buildAdjacency() {
    linked = {}
    nodes.forEach(function (d) { linked[d.id + "," + d.id] = true; });
    links.forEach(function (d) { linked[d.from + "," + d.to] = true; });
}

function neighboring(a, b) {
    return linked[a.id + "," + b.id];
}


update = function(n, l) {
    nodes = n;
    links = l;
    buildAdjacency();

    var c = Math.min(-700 + wminVal * 100, -250);
    var ld = Math.max(120 - wminVal * 10, 40);
    force.nodes(nodes)
        .links(links)
        .charge(c)
        .linkDistance(ld)
        .start();

    // Update links
    link = link.data(force.links(), function(d) { return d.id; });
    link.exit().remove();
    
    var a = link.enter().append("path");
    a.attr("class", "link")
        .classed("junction", function(d) { return (d.type == 'EJ' || d.type == 'NMJ')})
        .classed("hidden", function(d) { return (d.type=='EJ' && !showJunctions) || (d.type!='EJ' && !showSynapses); })
        .style("stroke-width", function(d) { return linkWeightScale(d.weight); })
        .style("stroke", function(d) { return colors[2]; })
        .style("opacity", 0.25)
        .attr("id", function(d) { return d.id; })
        .on("mouseover", linkMouseOver)
        .on("mouseout", linkMouseOut);


    // Update nodes
    node = node.data(force.nodes(), function(d) { return d.id; });
        
    var nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .on('click', function(d) { 
            if (d3.event.defaultPrevented) return;
            clicker(d, this);            
            d3.event.stopPropagation();
        })
        .call(drag);

    nodeEnter.append("circle")
        .attr("r", function(d) { return d.r; })
        .style("fill", function(d) { return colors[2]; });

    nodeEnter.append("text")
        .attr("class", "node-label")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .text(function(d) { return d.name; });

    nodeEnter.on("mouseover", function(d) {
        connectedNodes(d);
    });

    nodeEnter.on("mouseout", function(d) {
        connectedNodes(null);
    });

    node.exit().remove();

}

updateLinks = function(l) {
    
    links = l;
    force.links(links).start();
    
    link = link.data(force.links(), function(d) { return d.id; });
    link.exit().remove();
    
    var a = link.enter().append("path");
    a.attr("class", "link")
        .classed("junction", function(d) { return (d.type == 'EJ' || d.type == 'NMJ')})
        .classed("hidden", function(d) { return (d.type=='EJ' && !showJunctions) || (d.type!='EJ' && !showSynapses); })
        .style("stroke-width", function(d) { return linkWeightScale(d.weight); })
        .style("stroke", function(d) { return colors[1]; })
        .style("opacity", 0.25)
        .attr("id", function(d) { return d.id; })
        .on("mouseover", linkMouseOver)
        .on("mouseout", linkMouseOut);
}


tick = function() {
    force.on("tick", function(e) {
        
        // Add layer forces
        var k = 75 * e.alpha;
        nodes.forEach(function(n, i) {
            if(! n.fixed) {
                if (n.type.indexOf("muscle") > -1)// && n.y > 400) 
                    n.y += 2*k;
                else if (n.type.indexOf("sensory") > -1)// && n.y > 400) 
                    n.y -= k;
                else if (n.type.indexOf("motor") > -1)// && n.y < 600) 
                    n.y += k;
                if (n.name.slice(-1) == "L")// && n.x > 400)
                    n.x -= k
                else if (n.name.slice(-1) == "R")// && n.x < 600)
                    n.x += k;
            }
        });
        
        if(arcs) {
            link.attr("d", function(d) {

                // No midpoint
                // var dx = d.target.x - d.source.x,
                //     dy = d.target.y - d.source.y,                    
                //     dr = Math.sqrt(dx * dx + dy * dy),
                //     endx = d.target.x - dx/dr * d.target.r,
                //     endy = d.target.y - dy/dr * d.target.r,
                //     r = d.type=="Sp" ? 0 : d.type=="S" ? 1 : 2; 
                //     return "M" + d.source.x + "," + d.source.y + "A" + r*dr + "," + r*dr + " 0 0,1 " + endx + "," + endy;

                // Midpoint
                // var dx = d.target.x - d.source.x,
                //     dy = d.target.y - d.source.y,
                //     dr = Math.sqrt(dx * dx + dy * dy) / 2,
                //     mx = d.source.x + dx,
                //     my = d.source.y + dy,
                //     r = d.type=="Sp" ? 0 : d.type=="S" ? 1 : 2;
                //     return [
                //         "M", d.source.x, d.source.y,
                //         "A", dr, dr, 0,0,1, mx, my,
                //         "A", dr, dr, 0,0,1, d.target.x, d.target.y
                //     ].join(" ");
                    
                // // Midpoint v2
                var dx = d.target.x - d.source.x,
                    dy = d.target.y - d.source.y,
                    dr = Math.sqrt(dx * dx + dy * dy),
                    mx = (d.target.x + d.source.x) / 2,
                    my = (d.target.y + d.source.y) / 2,
                    len = dr - ((dr/2) * sqrt3),
                    dir = d.type=="S" ? 0 : 2;
                if (d.type=="EJ") {
                    dr = 0;
                }
                else {
                    mx += (dir-1) * dy * len/dr;
                    my += -(dir-1) * dx * len/dr;
                }

                return [
                    "M", d.source.x, d.source.y,
                    "A", dr, dr, 0, 0, dir/2, mx, my,
                    "A", dr, dr, 0, 0, dir/2, d.target.x, d.target.y
                ].join(" ");
            });
        }
        else {
            link.attr("d", function(d) {
                return [
                    "M", d.source.x, d.source.y,
                    "L", (d.source.x + d.target.x)/2, (d.source.y + d.target.y)/2,
                    "L", d.target.x, d.target.y
                ].join(" ");
            });
        }
        node.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });
        node.each(collide(0.2));
    });
}

dblclick_timer = false;
function clicker(d, elem) {
    if (dblclick_timer) {
        clearTimeout(dblclick_timer);
        dblclick_timer = false;
        nodeDblClicked(d, elem);
    }
    else dblclick_timer = setTimeout( function() {
        dblclick_timer = false;
        nodeClicked(d);
    }, 200);
};

function nodeClicked(d) {
    // Mark selected node      
    if (highlightId != d.id) {
        toggleSelected(highlightId, false);
        highlightId = d.id;
        toggleSelected(highlightId, true);
    }
    else
    {
        toggleSelected(highlightId, false);
        highlightId = -1;
    }
}

function nodeDblClicked(d, elem) {
    d.fixed = false; 
    d3.select(elem).select("circle").classed("fixed", false);
}

function dragstarted(d) {
     d3.event.sourceEvent.stopPropagation();
}

function dragged(d) {
    d3.event.sourceEvent.stopPropagation();
    d.fixed = true;
    d3.select(this).select("circle").classed("fixed", true);
}

function zoomed() {
  container.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

collide = function(alpha) {
    var padding = 1;    
    
    var quadtree = d3.geom.quadtree(nodes);
    return function(d) {
        var radius = nodeRadiusScale(d.D);
        var rb = 2*radius + padding,
        nx1 = d.x - rb,
        nx2 = d.x + rb,
        ny1 = d.y - rb,
        ny2 = d.y + rb;
        quadtree.visit(function(quad, x1, y1, x2, y2) {
            if (quad.point && (quad.point !== d)) {
                var x = d.x - quad.point.x,
                y = d.y - quad.point.y,
                l = Math.sqrt(x * x + y * y);
                if (l < rb) {
                    l = (l - rb) / l * alpha;
                    d.x -= x *= l;
                    d.y -= y *= l;
                    quad.point.x += x;
                    quad.point.y += y;
                }
            }
            return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
        });
    };
}

function toggleSelected(i, b) {
    node.filter(function(n) { return n.id == i; })
        .select("circle").classed("selected", b);
}

function connectedNodes(d) {
    if (d != null) {
        //Reduce the opacity of all but the neighbouring nodes
        node.style("opacity", function (o) {
            return neighboring(d, o) | neighboring(o, d) ? 1 : 0.1;
        });
        link.style("opacity", function (o) {
            return d.id==o.from | d.id==o.to ? 1 : 0.05;
        });
    } else {     
        node.style("opacity", 1);
        link.style("opacity", 0.25);
    }
}


function linkMouseOver(d) {
    //link.classed("active", function(p) { return p==d});
    d3.select(this)
        .style("opacity", 1);

    container.append("text")
        .attr("class","labelText")
        .style("font-size", "11px")
        .style("fill", colors[2])
        .attr("x", "50")
        .attr("y", "-20")
        .attr("dy", "-0.2em")
        .attr("text-anchor", "start")
        .append("textPath")
            .attr("xlink:href", '#' + d.id)
            .text(d.type + " " + d.weight); 
}

function linkMouseOut(d) {
    d3.select(this)
        .style("opacity", 0.25);
    container.selectAll(".labelText").remove();
}


function toggleSynapses(checkbox) {
    showSynapses = checkbox.checked;
    link.filter(function(d) { return d.type!="EJ"}).classed("hidden", !showSynapses);
}

function toggleJunctions(checkbox) {
    showJunctions = checkbox.checked;
    link.filter(function(d) { return d.type=="EJ"}).classed("hidden", !showJunctions);
}

function toggleArrows(checkbox) {
    showArrows = checkbox.checked;
    o = showArrows ? "visible" : "hidden";
    svg.selectAll("marker").attr("style", function(d) { return "fill: " + d + "; visibility:" + o +";"});
}

function arcsplease(checkbox) {
    force.stop();
    arcs = checkbox.checked;
    l=links;
    updateLinks([]);
    updateLinks(l);
}


function searchNode() {
    var selectedVal = document.getElementById('search-node').value;
    var sel = node.filter(function(d) { return d.name == selectedVal; });
    if(sel[0].length > 0) {
        nodeClicked(sel.data()[0]);
        connectedNodes(sel.data()[0]);        
    }
}


function initNodePos(neurons) {
    neurons.forEach(function(d) { 
        if (d.type.indexOf("sensory") > -1)
            d.y = 0;
        else if (d.type.indexOf("inter") > -1)
            d.y = height/2;
        else if (d.type.indexOf("motor") > -1)
            d.y = 3*height/4;
        else if (d.type.indexOf("muscle") > -1)
            d.y = height;

        if (d.name.slice(-2,-1) == "L")
            d.x = 0.25 * width;
        else if (d.name.slice(-1) == "R")
            d.x = 0.75 * width;

        // Fix AVAL and AVAR to the middle
        //if (d.name="AVAL")
        //d.fixed = true;        
    });
}

function addNodeRadius(neurons) {
   neurons.forEach(function(d) { d.r = nodeRadiusScale(d.D); });
}
