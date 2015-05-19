
d3.json("data/data.json", function(error, data) {

  if(error) {

    console.log(error);
  } else {

    drawGraph(data.relations);
  }
});


function drawGraph(links) {

  //sort links by source, then target
  links.sort(function(a,b) {
      if (a.source > b.source) {return 1;}
      else if (a.source < b.source) {return -1;}
      else {
          if (a.target > b.target) {return 1;}
          if (a.target < b.target) {return -1;}
          else {return 0;}
      }
  });

  //any links with duplicate source and target get an incremented 'linknum'
  for (var i=0; i<links.length; i++) {
      if (i != 0 &&
          links[i].source == links[i-1].source &&
          links[i].target == links[i-1].target) {
              links[i].linknum = links[i-1].linknum + 1;
          }
      else {links[i].linknum = 1;}
  }

  // Compute the distinct nodes from the links.
  var nodes = {};
  var linked = {};

  links.forEach(function(link) {
    link.source = nodes[link.source] || (nodes[link.source] = {name: link.source});
    link.target = nodes[link.target] || (nodes[link.target] = {name: link.target});
    linked[link.source.name + "," + link.target.name] = true;
  });

  var container = d3.select("#container");

  var width = parseInt(container.style('width')),
      height = parseInt(container.style('height'));

  var force = d3.layout.force()
      .nodes(d3.values(nodes))
      .links(links)
      .size([width, height])
      .linkDistance(150)
      .charge(-2000)
      .on("tick", tick)
      .start();

  var svg = container.append("svg:svg")
      .attr("width", width)
      .attr("height", height);

  // Per-type markers, as they don't inherit styles.
  svg.append("svg:defs").selectAll("marker")
      .data(["suit", "licensing", "resolved"])
    .enter()
    .append("svg:path")
      .attr("d", "M0,-5L10,0L0,5");

  var link = svg.append("svg:g").selectAll("path")
      .data(force.links())
    .enter().append("svg:path")
      .attr("class", function(d) { return "link " + d.type; });

  var node = svg.selectAll(".node")
      .data(force.nodes())
    .enter().append("g")
      .attr("class", "node")
      .on("mouseover", function(d) { connectedNodes(d); })
      .on("mouseout", function(d) { connectedNodes(null); })
      .call(force.drag);

  var marker = node.append("svg:circle")
      .attr("r", 10);

  var text = node.append("svg:text")
      .attr("x", 8)
      .attr("y", ".31em")
      .text(function(d) { return d.name; });

  // Use elliptical arc path segments to doubly-encode directionality.
  function tick() {
    link.attr("d", linkArc);
    node.attr("transform", transform);
  }

  function linkArc(d) {
    var dx = d.target.x - d.source.x,
        dy = d.target.y - d.source.y,
        dr = Math.sqrt(dx * dx + dy * dy);
    return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
  }

  function transform(d) {
    return "translate(" + d.x + "," + d.y + ")";
  }

  function connectedNodes(d) {
    if (d != null) {
      //Reduce the opacity of all but the neighbouring nodes
      node.style("opacity", function (o) {
        return neighboring(d, o) | neighboring(o, d) ? 1 : 0.1;
      });
      link.style("opacity", function (o) {
        return d.name==o.target.name | d.name==o.source.name ? 1 : 0.05;
      });
    } else {   
      node.style("opacity", 1);
      link.style("opacity", 0.25);
    }
  }

  function neighboring(a, b) {
    return linked[a.name + "," + b.name];
  }

}
