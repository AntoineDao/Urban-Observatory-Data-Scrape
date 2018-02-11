var streamContainer;
var websocket;
var streamData = [];
var filterElements = {};
var filterOptions = {};

var memoryMax = 10000;
var pageMax = 500;

function startStream() {
  streamContainer = document.getElementById('stream');
  websocket = new WebSocket((location.protocol.indexOf('s') >= 0 ? 'wss' : 'ws') + '://' + (location.host || 'localhost') + '/stream');
  websocket.addEventListener('message', function (m) {
    streamData = streamData.concat(m.data).slice(0, memoryMax);
    filterMessage(m.data);
  });
  document.querySelectorAll('.filter').forEach(function (select) {
    filterElements[select.id.replace('filter-', '')] = select;
    select.addEventListener('change', changeFilter);
  });
}

function changeFilter(changeEvent) {
  var variableName = changeEvent.target.id.replace('filter-', '');
  var variableFilter = changeEvent.target.value;

  if (variableFilter === 'true') variableFilter = true;
  if (variableFilter === 'false') variableFilter = false;

  filterOptions[variableName] = variableFilter;

  streamContainer.innerHTML = '<li>Stream filters changed...</li>';
  streamData.forEach(function (m) {
    filterMessage(m);
  });
}

function filterMessage(m) {
  var payload = JSON.parse(m);
  if (!payload.data || !payload.data.brokerage) return;
  console.log(payload.data);

  var units = (payload.data.timeseries || {}).unit || '';
  if (units === 'no units' || units === 'unknown') {
    units = undefined;
  }
  var metadata = {};
  Object.assign(metadata, payload.data.brokerage.broker.meta);
  Object.assign(metadata, payload.data.brokerage.meta);
  Object.assign(metadata, payload.data.entity.meta);
  Object.assign(metadata, payload.data.feed.meta);

  var location = metadata.roomNumber ? ('Room ' + metadata.roomNumber) : undefined;
  if (metadata.roomNumber && metadata.roomZone) {
    location += ' Zone ' + metadata.roomZone;
  }
  if (!location && metadata.plantRoom) {
    location = 'Floor ' + metadata.buildingFloor + ' Plant Room ' + metadata.plantRoom
  }
  if (location && metadata.roomDescription) {
    location += ' (' + metadata.roomDescription + ')';
  }
  var variable = payload.data.feed.metric || payload.data.brokerage.id;
  if (!location && payload.data.feed.metric && payload.data.brokerage.id) {
    variable += ' (' + payload.data.brokerage.id + ')';
  }
  var roomsOnly = filterOptions.roomOnly;
  if (payload.data.timeseries.value.data !== undefined && (!roomsOnly || metadata.roomNumber)) {
    addStream(
      payload.data.timeseries.value.time,
      (variable || '').replace(/CO2/g, 'CO<sub>2</sub>'),
      location,
      parseFloat(payload.data.timeseries.value.data.toPrecision(3)),
      units,
      payload.data.brokerage.id
    );
  }
}

function addStream(timestamp, variable, location, value, units, name) {
  if (!streamContainer || !variable) return;
  var listElement = document.createElement('li');
  var variableMain = ((variable.match(/^[^\(]+/) || [])[0] || '').trim();
  variable = variableMain ?
    '<span class="variable"><a title="' + name + '">' + variableMain + '</a></span>' + variable.replace(variableMain, '') :
    '<span class="variable"><a title="' + name + '">' + variable + '</a></span>';
  var locationString = variable && location ? (variable + ' in <strong>' + location + '</strong>') : variable;
  listElement.innerHTML = '\
    <span class="timestamp">' + timestamp + '</span> \
    <span class="description">' + locationString + ' is now <span class="number">' + value + '</span>' + (units ? ' ' + units : '') + '.</span>\
  ';
  streamContainer.insertBefore(listElement, streamContainer.firstElementChild);
  removeExcessChildren(streamContainer, pageMax);
}

function removeExcessChildren(target, maximumChildren) {
  if (target.children.length <= maximumChildren) return;
  while (target.children.length > maximumChildren) {
    target.removeChild(target.children[target.children.length - 1]);
  }
}

window.addEventListener('load', startStream);
