import {
  formatCoordinates,
  formatDateRange,
  localized,
  message,
  vocabularyLabel,
} from './i18n.js';

const SHAPES = Object.freeze({
  settlement: 'circle',
  sanctuary: 'diamond',
  polity: 'square',
});

const BASEMAP_DEFINITIONS = Object.freeze({
  positron: Object.freeze({
    label: 'CARTO Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    options: Object.freeze({
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 20,
      subdomains: 'abcd',
    }),
  }),
  osm: Object.freeze({
    label: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: Object.freeze({
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }),
  }),
});

function escapeAttribute(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function spatialModifier(role) {
  if (role === 'proxy') return ' is-proxy';
  if (role === 'representative_center') return ' is-representative';
  return '';
}

export function markerDescriptor(entity, lang = 'el') {
  const title = localized(entity.name, lang);
  const classLabel = vocabularyLabel('entityClass', entity.entityClass, lang);
  const spatialRole = entity.place?.geometryRole ?? 'site';
  const spatialLabel = vocabularyLabel('geometryRole', spatialRole, lang);
  return Object.freeze({
    id: entity.id,
    coordinates: Object.freeze([entity.place.latitude, entity.place.longitude]),
    entityClass: entity.entityClass,
    shape: SHAPES[entity.entityClass] ?? 'circle',
    text: '',
    title,
    spatialRole,
    className: `atlas-marker marker-${entity.entityClass}${spatialModifier(spatialRole)}`,
    ariaLabel: `${title}. ${classLabel}. ${spatialLabel}.`,
  });
}

export function clusterDescriptor(count, lang = 'en') {
  const numericCount = Math.max(0, Math.trunc(Number(count) || 0));
  const label = lang === 'el'
    ? `${numericCount} ${numericCount === 1 ? 'εγγραφή' : 'εγγραφές'}`
    : `${numericCount} ${numericCount === 1 ? 'record' : 'records'}`;
  return Object.freeze({
    count: numericCount,
    size: numericCount < 10 ? 'small' : numericCount < 100 ? 'medium' : 'large',
    ariaLabel: label,
  });
}

function iconMarkup(descriptor, selected = false) {
  const className = `${descriptor.className}${selected ? ' is-selected' : ''}`;
  return `<span class="${escapeAttribute(className)}" role="img" aria-label="${escapeAttribute(descriptor.ariaLabel)}"><span class="atlas-marker-core" aria-hidden="true"></span></span>`;
}

function makeIcon(L, descriptor, selected = false) {
  return L.divIcon({
    className: 'atlas-marker-anchor',
    html: iconMarkup(descriptor, selected),
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -13],
  });
}

function appendTextElement(parent, tag, className, text) {
  if (!String(text ?? '').trim()) return null;
  const node = parent.ownerDocument.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  parent.append(node);
  return node;
}

function previewNode(entity, lang, onSelect) {
  const document = globalThis.document;
  const root = document.createElement('article');
  root.className = `map-preview type-${entity.entityClass}`;

  const heading = appendTextElement(root, 'h3', 'map-preview-title', localized(entity.name, lang));
  if (heading) heading.id = `map-preview-${entity.id}`;
  const ancient = appendTextElement(root, 'p', 'map-preview-ancient', entity.ancientName);
  if (ancient) ancient.lang = 'grc';

  const classification = [
    vocabularyLabel('entityClass', entity.entityClass, lang),
    ...(entity.collections ?? []).map((value) => vocabularyLabel('collection', value, lang)),
  ].filter(Boolean).join(' · ');
  appendTextElement(root, 'p', 'map-preview-classification', classification);

  const place = [
    entity.place?.locality,
    localized(entity.region, lang),
    localized(entity.place?.country, lang),
  ].filter(Boolean).join(' · ');
  appendTextElement(root, 'p', 'map-preview-place', place);

  const chronology = entity.chronologies?.find(({ displayCutoff }) => displayCutoff)
    ?? entity.chronologies?.[0];
  if (chronology) appendTextElement(root, 'p', 'map-preview-date', formatDateRange(chronology, lang));

  if (entity.place?.geometryRole !== 'site') {
    appendTextElement(
      root,
      'p',
      'map-preview-uncertainty',
      vocabularyLabel('geometryRole', entity.place.geometryRole, lang),
    );
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'map-preview-action';
  button.dataset.previewDetails = entity.id;
  button.textContent = message(lang, 'viewRecord');
  button.addEventListener('click', () => onSelect(entity.id));
  root.append(button);
  return root;
}

function updateControlLabels(zoomControl, layerControl, lang) {
  const zoomLabels = lang === 'el'
    ? ['Μεγέθυνση', 'Σμίκρυνση']
    : ['Zoom in', 'Zoom out'];
  const links = zoomControl?.getContainer?.().querySelectorAll?.('a') ?? [];
  for (const [index, label] of zoomLabels.entries()) {
    links[index]?.setAttribute('title', label);
    links[index]?.setAttribute('aria-label', label);
  }
  const layerLabel = lang === 'el' ? 'Χάρτες βάσης' : 'Basemaps';
  const toggle = layerControl?.getContainer?.().querySelector?.('.leaflet-control-layers-toggle');
  toggle?.setAttribute('title', layerLabel);
  toggle?.setAttribute('aria-label', layerLabel);
}

function updateLegend(elements, entities, total, lang) {
  if (!elements) return;
  const counts = { settlement: 0, sanctuary: 0, polity: 0 };
  for (const entity of entities) {
    if (Object.hasOwn(counts, entity.entityClass)) counts[entity.entityClass] += 1;
  }
  for (const key of Object.keys(counts)) {
    if (elements[key]) elements[key].textContent = String(counts[key]);
  }
  if (elements.visibleStatus) {
    elements.visibleStatus.textContent = message(lang, 'visibleStatus', {
      visible: entities.length,
      total,
    });
  }
}

function validViewport(viewport) {
  const latitude = Number(viewport?.latitude);
  const longitude = Number(viewport?.longitude);
  const zoom = Number(viewport?.zoom);
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    && Number.isInteger(zoom) && zoom >= 2 && zoom <= 18;
}

export function createAtlasMap(options) {
  const {
    element,
    entities: initialEntities = [],
    lang: initialLanguage = 'el',
    viewport = { latitude: 38.4, longitude: 24.5, zoom: 4 },
    basemap: initialBasemap = 'positron',
    totalCount = initialEntities.length,
    legendElements = null,
    onSelect = () => {},
    onPreview = () => {},
    onLeavePreview = () => {},
    onViewportChange = () => {},
    onBasemapChange = () => {},
    onTileError = () => {},
    leaflet = globalThis.L,
  } = options ?? {};

  if (!element) throw new TypeError('A map element is required.');
  if (!leaflet?.map || !leaflet?.markerClusterGroup || !leaflet?.divIcon) {
    throw new Error('Leaflet and Leaflet.markercluster are unavailable.');
  }

  const L = leaflet;
  let language = initialLanguage === 'en' ? 'en' : 'el';
  let visibleEntities = [];
  let selectedId = null;
  let previewId = null;
  let activeBasemap = Object.hasOwn(BASEMAP_DEFINITIONS, initialBasemap) ? initialBasemap : 'positron';
  let viewportTimer = null;
  let suppressViewport = false;
  let destroyed = false;
  const records = new Map();
  const markers = new Map();

  const map = L.map(element, {
    zoomControl: false,
    minZoom: 2,
    maxZoom: 18,
    worldCopyJump: true,
    keyboard: true,
  });
  const initialViewport = validViewport(viewport)
    ? viewport
    : { latitude: 38.4, longitude: 24.5, zoom: 4 };
  map.setView([initialViewport.latitude, initialViewport.longitude], initialViewport.zoom, { animate: false });

  const layers = Object.fromEntries(Object.entries(BASEMAP_DEFINITIONS).map(([id, definition]) => {
    const layer = L.tileLayer(definition.url, { ...definition.options });
    layer.on?.('tileerror', onTileError);
    return [id, layer];
  }));
  layers[activeBasemap].addTo(map);

  const zoomControl = L.control?.zoom?.({ position: 'topleft' })?.addTo(map);
  const controlLayers = Object.fromEntries(Object.entries(layers).map(([id, layer]) => [BASEMAP_DEFINITIONS[id].label, layer]));
  const layerControl = L.control?.layers?.(controlLayers, null, { position: 'topright', collapsed: true })?.addTo(map);

  const cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 46,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    removeOutsideVisibleBounds: true,
    iconCreateFunction(group) {
      const descriptor = clusterDescriptor(group.getChildCount(), language);
      return L.divIcon({
        className: `atlas-cluster atlas-cluster-${descriptor.size}`,
        html: `<span class="atlas-cluster-count" role="img" aria-label="${escapeAttribute(descriptor.ariaLabel)}">${descriptor.count}</span>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
    },
  });
  map.addLayer(cluster);

  function markerFor(entity) {
    const descriptor = markerDescriptor(entity, language);
    const marker = L.marker(descriptor.coordinates, {
      icon: makeIcon(L, descriptor, selectedId === entity.id),
      title: descriptor.title,
      keyboard: true,
      riseOnHover: true,
      alt: descriptor.ariaLabel,
    });
    marker.bindPopup(previewNode(entity, language, onSelect), {
      className: 'atlas-preview-popup',
      maxWidth: 340,
      minWidth: 250,
      offset: [0, -10],
      closeButton: true,
      autoPan: true,
      autoPanPadding: [20, 20],
    });
    const showPreview = () => {
      previewId = entity.id;
      marker.openPopup?.();
      onPreview(entity.id);
    };
    const leavePreview = () => onLeavePreview(entity.id);
    marker.on('mouseover', showPreview);
    marker.on('focus', showPreview);
    marker.on('mouseout', leavePreview);
    marker.on('blur', leavePreview);
    marker.on('click', () => {
      previewId = entity.id;
      onSelect(entity.id);
    });
    return marker;
  }

  function removeEntity(id) {
    const marker = markers.get(id);
    if (!marker) return;
    cluster.removeLayer(marker);
    markers.delete(id);
    records.delete(id);
    if (previewId === id) {
      map.closePopup?.();
      previewId = null;
      onLeavePreview(id);
    }
  }

  function addEntity(entity) {
    const marker = markerFor(entity);
    records.set(entity.id, entity);
    markers.set(entity.id, marker);
    cluster.addLayer(marker);
  }

  function signature(entity, lang) {
    return [
      lang,
      entity.entityClass,
      entity.place.latitude,
      entity.place.longitude,
      entity.place.geometryRole,
      localized(entity.name, lang),
      entity.ancientName,
    ].join('|');
  }

  function setEntities(entities, lang = language) {
    if (destroyed) return;
    const nextLanguage = lang === 'en' ? 'en' : 'el';
    const nextById = new Map(entities.map((entity) => [entity.id, entity]));
    for (const id of [...markers.keys()]) {
      const next = nextById.get(id);
      const current = records.get(id);
      if (!next || signature(current, language) !== signature(next, nextLanguage)) removeEntity(id);
    }
    language = nextLanguage;
    for (const entity of entities) {
      if (!markers.has(entity.id)) addEntity(entity);
      else records.set(entity.id, entity);
    }
    visibleEntities = [...entities];
    updateControlLabels(zoomControl, layerControl, language);
    updateLegend(legendElements, visibleEntities, totalCount, language);
  }

  function setSelected(id) {
    if (destroyed || id === selectedId) return;
    const previousId = selectedId;
    selectedId = records.has(id) ? id : null;
    for (const entityId of [previousId, selectedId].filter(Boolean)) {
      const marker = markers.get(entityId);
      const entity = records.get(entityId);
      if (marker && entity) marker.setIcon(makeIcon(L, markerDescriptor(entity, language), selectedId === entityId));
    }
  }

  function focusEntity(id, focusOptions = {}) {
    const marker = markers.get(id);
    const entity = records.get(id);
    if (!marker || !entity) return false;
    const { openPreview = true, zoom = Math.max(map.getZoom(), 9), animate = true } = focusOptions;
    const destination = [entity.place.latitude, entity.place.longitude];
    const reveal = () => {
      if (openPreview) {
        previewId = id;
        marker.openPopup?.();
      }
    };
    if (cluster.zoomToShowLayer && openPreview) {
      const move = () => cluster.zoomToShowLayer(marker, reveal);
      if (animate && map.flyTo) map.flyTo(destination, zoom, { duration: 0.55 });
      else map.setView(destination, zoom, { animate: false });
      move();
    } else {
      map.setView(destination, zoom, { animate: Boolean(animate) });
      reveal();
    }
    return true;
  }

  function fitAll() {
    const bounds = cluster.getBounds?.();
    if (!bounds || bounds.isValid?.() === false) return false;
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 9 });
    return true;
  }

  function setBasemap(id, { notify = false } = {}) {
    if (!Object.hasOwn(layers, id) || id === activeBasemap) return false;
    map.removeLayer?.(layers[activeBasemap]);
    layers[id].addTo(map);
    activeBasemap = id;
    if (notify) onBasemapChange(id);
    return true;
  }

  function restoreViewport(nextViewport) {
    if (!validViewport(nextViewport)) return false;
    suppressViewport = true;
    map.setView([nextViewport.latitude, nextViewport.longitude], nextViewport.zoom, { animate: false });
    globalThis.setTimeout(() => { suppressViewport = false; }, 0);
    return true;
  }

  function viewportChanged() {
    if (suppressViewport || destroyed) return;
    globalThis.clearTimeout(viewportTimer);
    viewportTimer = globalThis.setTimeout(() => {
      if (suppressViewport || destroyed) return;
      const centre = map.getCenter();
      onViewportChange({
        latitude: Number(centre.lat.toFixed(6)),
        longitude: Number(centre.lng.toFixed(6)),
        zoom: map.getZoom(),
      });
    }, 100);
  }

  function pointerMoved(event) {
    if (!legendElements?.coordinateStatus || !event?.latlng) return;
    legendElements.coordinateStatus.textContent = formatCoordinates(event.latlng.lat, event.latlng.lng, language);
  }

  function baseLayerChanged(event) {
    const id = Object.entries(layers).find(([, layer]) => layer === event.layer)?.[0];
    if (!id || id === activeBasemap) return;
    activeBasemap = id;
    onBasemapChange(id);
  }

  map.on('moveend zoomend', viewportChanged);
  map.on('mousemove', pointerMoved);
  map.on('baselayerchange', baseLayerChanged);
  setEntities(initialEntities, language);

  return Object.freeze({
    setEntities,
    setSelected,
    focusEntity,
    previewEntity: (id) => focusEntity(id, { openPreview: true, animate: false }),
    closePreview() {
      map.closePopup?.();
      previewId = null;
    },
    fitAll,
    setBasemap,
    restoreViewport,
    invalidateSize: () => map.invalidateSize?.({ pan: false }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      globalThis.clearTimeout(viewportTimer);
      map.off?.('moveend zoomend', viewportChanged);
      map.off?.('mousemove', pointerMoved);
      map.off?.('baselayerchange', baseLayerChanged);
      for (const layer of Object.values(layers)) layer.off?.('tileerror', onTileError);
      map.remove?.();
      markers.clear();
      records.clear();
    },
  });
}

export { BASEMAP_DEFINITIONS };

