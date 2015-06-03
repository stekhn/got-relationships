var currentEpisode = 10;

var node, link, marker, text, shadow, force, svg;
var nodes = {};
var linked = {};

var model;
var characters;
var relations;

var container = d3.select('#container');
var info = d3.select('#info');
var sidebar = d3.select('#sidebar');
var slider = d3.select('#slider');
var episode = d3.select('#episode');

var width = parseInt(container.style('width')),
    height = parseInt(container.style('height'));


// Load data from JSON and initialize the app
d3.json('data/data.json', function(error, data) {
  if(error) {
    console.log(error);
  } else {
    model = data;
    relations = data.relations;
    characters = data.characters;
    // sortData(relations, characters);
    sortData();
  }
});

// Update graph on slider events
slider.on('input', function() {
  var arr = this.value.split('');
  episode.text(arr[0] + 'x' + (parseInt(arr[1]) + 1));

  currentEpisode = parseInt(this.value);
  sortData();
});

function sortData() {

  // Filter out all relations which are not related to the current episode
  relations = copyObject(model.relations)
    .filter(function (rel) {
      return convertEpisodeFormat(rel.end) >= currentEpisode &&
        convertEpisodeFormat(rel.start) <= currentEpisode;
    });

  // characters = copyObject(model.characters)
  //   .filter(function (p) {
  //     return convertEpisodeFormat(p.killed) >= currentEpisode;  
  //   });

  // Sort relations by source, then target. Speeds up inital drawing.
  relations.sort(function(a,b) {
    if (a.source > b.source) {return 1;}
    else if (a.source < b.source) {return -1;}
    else {
      if (a.target > b.target) {return 1;}
      if (a.target < b.target) {return -1;}
      else {return 0;}
    }
  });

  // Any relations with duplicate source and target get an incremented 'linknum'
  for (var i=0; i<relations.length; i++) {
    if (i !== 0 &&
      relations[i].source == relations[i-1].source &&
      relations[i].target == relations[i-1].target) {
          relations[i].linknum = relations[i-1].linknum + 1;
      }
    else {relations[i].linknum = 1;}
  }

  // Compute the distinct nodes from the relations.
  relations.forEach(function(link) {
    link.source = nodes[link.source] || (nodes[link.source] = {name: link.source});
    link.target = nodes[link.target] || (nodes[link.target] = {name: link.target});
    linked[link.source.name + ',' + link.target.name] = true;
  });

  console.log("episode: ", currentEpisode, "n-characters: ", characters.length, "n-relation: ", relations.length);

  update();
}


function update() {

  force = d3.layout.force()
    .nodes(d3.values(nodes))
    .links(relations)
    .size([width, height])
    .gravity(0.1)
    .linkDistance(150)
    .charge(-2000)
    .on('tick', tick)
    .start();

  svg = container.append('svg:svg')
    .attr('width', width)
    .attr('height', height);

  // var marker = svg.append('defs').selectAll('marker')
  //     .data(['end'])
  //   .enter().append('marker')
  //     .attr('id', function(d) { return d; })
  //     .attr('viewBox', '0 -5 10 10')
  //     .attr('refX', 15)
  //     .attr('refY', -1.5)
  //     .attr('markerWidth', 6)
  //     .attr('markerHeight', 6)
  //     .attr('orient', 'auto')
  //   .append('path')
  //     .attr('d', 'M0,-5L10,0L0,5');

  link = svg.append('svg:g').selectAll('path')
      .data(force.links())
    .enter().append('svg:path')
      .attr('class', function(d) { return 'link ' + d.type; })
      // .attr('marker-end', 'url(#end)')
      .style('opacity', 0.25);

  node = svg.selectAll('.node')
      .data(force.nodes())
    .enter().append('g')
      .attr('class', 'node')
      .style('opacity', 1)
      .on('mouseover', function(d) {
        connectedNodes(d);
        displayInfo(d);
        displayRelations(d, relations);
      })
      .on('mouseout', function(d) {
        connectedNodes(null);
      })
      .call(force.drag);

  marker = node.append('svg:circle')
      .attr('class', function(d) {
        d.person = getFirstObjectByValue(characters, 'name', d.name);
        if (d.person) {
          return d.person.faction;
        }
      })
      .attr('r', function (d) {
        return (d.weight - 2) * 0.1 + 7;
      });

  text = node.append('svg:text')
      .attr('x', 14)
      .attr('y', '.35em')
      .attr('class', 'shadow') 
      .text(function(d) { return d.name; });

  shadow = node.append('svg:text')
      .attr('x', 14)
      .attr('y', '.4em')
      .text(function(d) { return d.name; });
}

function tick() {
  link.attr('d', linkArc);
  node.attr('transform', transform);
}

// Use elliptical arc path segments to doubly-encode directionality.
function linkArc(d) {
  var dx = d.target.x - d.source.x,
      dy = d.target.y - d.source.y,
      dr = Math.sqrt(dx * dx + dy * dy);
  return 'M' + d.source.x + ',' + d.source.y + 'A' + dr + ',' + dr + ' 0 0,1 ' + d.target.x + ',' + d.target.y;
}

function connectedNodes(d) {
  if (d != null) {

    //Reduce the opacity of all but the neighbouring nodes and the source node
    node.style('opacity', function (o) {

      // Highlight incoming and outgoing relations
      // return d.name==o.name | neighboring(d, o) | neighboring(o, d) ? 1 : 0.1;

      // Highlight outgoing relations
      return d.name==o.name | neighboring(d, o)  ? 1 : 0.1;
    });
    link.style('opacity', function (o) {

      // Highlight incoming and outgoing relations
      // return d.name==o.target.name | d.name==o.source.name ? 1 : 0.05;
      
      // Highlight outgoing relations
      return d.name==o.source.name ? 1 : 0.05;
    });
  } else {   
    node.style('opacity', 1);
    link.style('opacity', 0.25);
  }
}

function displayInfo(d) {
  console.log(d);
  info.html(
    '<h2 class="' + d.person.faction + '">' + d.name + '</h2>' + 
    '<p>' + d.person.faction + '<br>' +
    (d.person["first-appearance"] ? "first appearance in " + d.person["first-appearance"] : "&nbsp") + '<br>' +
    (d.person.killed ? "killed in " + d.person.killed : "&nbsp") + '</p>'
  );
}

function displayRelations(d) {
  var str = "<p>";
  var rels = relations.filter(function (o) {
    return o.source.name == d.name;
  });
  for (var i = 0; i < rels.length; i++) {
    str += '<span class="' + rels[i].type + '">' + rels[i].source.name + ' ' + rels[i].type + ' ' + rels[i].target.name + '</span><br>';
  }
  sidebar.html(str + '</p>');
}

// Converts epsiode 1x10 to integer 19
function convertEpisodeFormat(episode) {
  if (!episode) {return true;}
  var arr = episode.split("x");
  return parseInt(arr[0] + (arr[1] - 1));
}

function getFirstObjectByValue(obj, prop, value) {
  return obj.filter(function (o) {
    return o[prop] == value;
  })[0];
}

function copyObject(obj) {
    if (null === obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}

function neighboring(a, b) {
  return linked[a.name + ',' + b.name];
}

function transform(d) {
  return 'translate(' + d.x + ',' + d.y + ')';
}

