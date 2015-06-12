var lang = 'de';
var currentEpisode = 10;

var node, link, marker, text, shadow, force, drag, rect, svg;
var nodes = {};
var linked = {};

var model;
var characters;
var relations;

var container = d3.select('.container');
var sidebar = d3.select('.sidebar');
var close = d3.select('.close');
var open = d3.select('.open');
var info = d3.select('.info');
var list = d3.select('.list');
var slider = d3.select('.slider');
var sliderWrapper = d3.select('.slider-wrapper');
var episode = d3.select('.episode');

var isDragging = false;

var width = parseInt(container.style('width')),
    height = parseInt(container.style('height')),
    radius = 20;

// Load data from JSON and initialize the app
d3.json('data/data.json', function(error, data) {
  if(error) {
    console.log(error);
  } else {
    model = data;

    getEpisodeFromURL();
    lang = getURLParameter('lang') || 'de';
    setInterfaceLanguage();
    sortData();
    drawGraph();
  }
});

// Update graph on slider events
slider.on('input', function() {
  setEpisode(this.value);
  resetGraph();
  sortData();
  drawGraph();
});

close.on('click', function () {
  sliderWrapper.style('padding-left', '0');
  sidebar.style('left', '-340px');
  open.style('left', '40px');
});

open.on('click', function () {
  sliderWrapper.style('padding-left', '340px');
  sidebar.style('left', '0');
  open.style('left', '-100px');
});

function sortData() {
  relations = cloneObject(model.relations);
  characters = cloneObject(model.characters);

  // Filter out all relations which are not related to the current episode
  relations = relations.filter(function (rel, index) {
    var source = getFirstObjectByValue(characters, 'name', rel.source);
    var target = getFirstObjectByValue(characters, 'name', rel.target);

    return convertToNumber(source['first-appearance']) <= currentEpisode &&
      (convertToNumber(source.killed) || Infinity) >= currentEpisode &&
      convertToNumber(target['first-appearance']) <= currentEpisode &&
      (convertToNumber(target.killed) || Infinity) >= currentEpisode &&
      convertToNumber(rel.start) <= currentEpisode &&
      (convertToNumber(rel.end) || Infinity) >= currentEpisode
      //&& source.name == 'Cersei Lannister';
  });

  // Sort relations by source, then target. Speeds up inital drawing.
  relations.sort(function (a, b) {
    if (a.source > b.source) {return 1;}
    else if (a.source < b.source) {return -1;}
    else {
      if (a.target > b.target) {return 1;}
      if (a.target < b.target) {return -1;}
      else {return 0;}
    }
  });

  relations.forEach(function (relation, i) {
  
    // Any relations with duplicate source and target get an incremented 'linknum'
    if (i !== 0 &&
      relation.source == relations[i-1].source.name &&
      relation.target == relations[i-1].target.name) {
          relation.linknum = relations[i-1].linknum + 1;
    } else {
      relation.linknum = 1;
    }

    // Compute the distinct nodes from the relations.
    if (nodes[relation.source]) {
      relation.source = nodes[relation.source];
    } else {
      nodes[relation.source] = {name: relation.source};
      relation.source = nodes[relation.source];
    }

    if(nodes[relation.target]) {
      relation.target = nodes[relation.target];
    } else {
      nodes[relation.target] = {name: relation.target};
      relation.target = nodes[relation.target];
    }

    linked[relation.source.name + ',' + relation.target.name] = true;
  });
}

function drawGraph() {
   force = d3.layout.force()
      .nodes(d3.values(nodes))
      .links(relations)
      .size([width * 1.3, height])
      .gravity(0.1)
      .linkDistance(150)
      .charge(-500)
      .on('tick', tick)
      .start();

  svg = container.append('svg:svg')
      .attr('width', width)
      .attr('height', height)
      .attr("pointer-events", "all")
    .append('svg:g')
      .call(d3.behavior.zoom().on("zoom", scale))
    .append('svg:g');

  rect = svg.append('svg:rect')
      .attr('width', width*2)
      .attr('height', height*2)
      .attr('x', width/2 - width)
      .attr('y', height/2 - height)
      .attr('fill', '#fcfcfc')
      .attr('fill-opacity', '0');

  drag = d3.behavior.drag()
      .origin(function(d) { return d; })
      .on("dragstart", dragstart)
      .on("drag", dragging)
      .on("dragend", dragend);

  link = svg.append('svg:g').selectAll('path')
      .data(force.links())
    .enter().append('svg:path')
      .attr('class', function(d) { return 'link ' + d.type; })
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
    .call(drag);

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

  shadow = node.append('svg:text')
      .attr('x', 14)
      .attr('y', '.35em')
      .attr('class', 'shadow') 
      .text(function(d) { return d.name; });

  text = node.append('svg:text')
      .attr('x', 14)
      .attr('y', '.4em')
      .text(function(d) { return d.name; });
}

function scale() {
  svg.attr('transform',
      'translate(' + d3.event.translate + ')' +
      ' scale(' + d3.event.scale + ')');
}

function tick() {
  var q = d3.geom.quadtree(nodes),
      i = 0,
      n = nodes.length;

  while (++i < n) q.visit(collide(nodes[i]));
  
  link.attr('d', drawLinks);
  node.attr('transform', drawNode);
}

function resetGraph() {
  d3.select("svg").remove();
  node = {};
  link = [];
  linked = [];

  //@TODO Rather remove single nodes manually
  nodes = [];
  characters = [];
  relations = [];
  force.start();
  d3.timer(force.resume);
}

// Use elliptical arc path segments to doubly-encode directionality.
function drawLinks(d) {
  var dx = d.target.x - d.source.x,
      dy = d.target.y - d.source.y,
      dr = Math.sqrt(dx * dx + dy * dy);

  return 'M' + d.source.x + ',' + d.source.y + 'A' + dr + ',' + dr * d.linknum + ' 0 0,1 ' + d.target.x + ',' + d.target.y;
}

function drawNode(d) {
  return 'translate(' + d.x + ',' + d.y + ')';
}

function connectedNodes(d) {
  if (!isDragging) {
    if (d !== null) {

      //Reduce the opacity of all but the neighbouring nodes and the source node
      node.style('opacity', function (o) {

        // Highlight outgoing relations
        return d.name==o.name | neighboring(d, o)  ? 1 : 0.1;
      });
      link.style('opacity', function (o) {

        // Highlight outgoing relations
        return d.name==o.source.name ? 1 : 0.05;
      });
    } else {   
      node.style('opacity', 1);
      link.style('opacity', 0.25);
    }
  }
}

function dragstart(d) {
  isDragging = true;
  d3.event.sourceEvent.stopPropagation();
  d3.select(this).classed("dragging", true);
  force.stop();
}

function dragging(d) {
  d3.select(this).attr("cx", d.x = d3.event.x).attr("cy", d.y = d3.event.y);
  tick();
}

function dragend(d) {
  isDragging = false;
  d3.select(this).classed("dragging", false);
  tick();
  force.resume();

  connectedNodes(d);
}

function collide(node) {
  var r = node.radius + 16,
      nx1 = node.x - r,
      nx2 = node.x + r,
      ny1 = node.y - r,
      ny2 = node.y + r;
  return function(quad, x1, y1, x2, y2) {
    if (quad.point && (quad.point !== node)) {
      var x = node.x - quad.point.x,
          y = node.y - quad.point.y,
          l = Math.sqrt(x * x + y * y),
          r = node.radius + quad.point.radius;
      if (l < r) {
        l = (l - r) / l * 0.5;
        node.x -= x *= l;
        node.y -= y *= l;
        quad.point.x += x;
        quad.point.y += y;
      }
    }
    return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
  };
}

function displayInfo(d) {
  if (!isDragging) {
    info.html(
      '<h2 class="' + d.person.faction + '">' + d.name + '</h2>' + 
      '<img src="img/' + toDashCase(d.name) + '.jpg" alt="' + d.name + '">' +
      '<p>' + translate(d.person.faction) + '<br>' +
      (d.person["first-appearance"] ? translate('first in') + ' ' + d.person["first-appearance"] : "&nbsp") + '<br>' +
      (d.person.killed ? translate('killed in') + ' ' + d.person.killed : '') + '</p>'
    );
  }
}

function displayRelations(d) {
  if (!isDragging) {
    var str = "";
    var rels = relations.filter(function (rel) {
      return rel.source.name == d.name;
      //return rel.source.name == d.name && convertToNumber(rel.start) <= currentEpisode;
    });
    for (var i = 0; i < rels.length; i++) {
      str +=  '<p>... ' +
        translate(rels[i].type) + ' ' +
        '<span class="' + rels[i].target.person.faction + '">' +
        rels[i].target.name +
        '</span> <span class="' + rels[i].type + '">–</span>' +
        '</p>';
    }
    list.html(str + '</p>');
  }
}

// Converts epsiode 1x10 to integer 19
function convertToNumber(episode) {
  if (!episode) { return false; }
  var arr = episode.toString().split("x");
  return parseInt(arr[0] + (arr[1] - 1));
}

// Converts integer 19 to epsiode 1x10 
function convertToString(number) {
  var arr = number.toString().split('');
  return arr[0] + 'x' + (parseInt(arr[1]) + 1);
}

function getEpisodeFromURL() {
  if (location.hash) {
    var hashEpisode = convertToNumber(location.hash.replace('#', '')) || 10;
    slider.property('value', hashEpisode || 10);
    episode.text(convertToString(hashEpisode));
  }
}

function setEpisode(value) {
  currentEpisode = convertToNumber(value);
  location.hash = convertToString(currentEpisode);
  episode.text(convertToString(currentEpisode));
}


function toDashCase(str) {
  return str.replace(/\s+/g, '-').toLowerCase();
}

function getFirstObjectByValue(obj, prop, value) {
  return obj.filter(function (o) {
    return o[prop] == value;
  })[0];
}

function getElementsByAttribute(attr) {
  return document.querySelectorAll('[' + attr + ']');
}

function cloneObject(obj) {
    var copy;
    if (null === obj || "object" != typeof obj) return obj;
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }
    if (obj instanceof Array) {
        copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = cloneObject(obj[i]);
        }
        return copy;
    }
    if (obj instanceof Object) {
        copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = cloneObject(obj[attr]);
        }
        return copy;
    }
    throw new Error();
}

function neighboring(a, b) {
  return linked[a.name + ',' + b.name];
}

function translate(i18n) {
  var entry = getFirstObjectByValue(model.translation, 'i18n', i18n);
  return entry ? entry[lang] || i18n : i18n;
}

function setInterfaceLanguage() {
  var elements = getElementsByAttribute('data-i18n');

  for (var i = 0; i < elements.length; i++) {
    var i18n = elements[i].getAttribute('data-i18n');
    var translation = translate(i18n);
    if (translation != i18n) {
      elements[i].innerHTML = translate(i18n);
    }
  }
}

function getURLParameter(name) {
  return decodeURIComponent((
    new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)')
      .exec(location.search) || [,""])[1]
      .replace(/\+/g, '%20')) || null;
}
