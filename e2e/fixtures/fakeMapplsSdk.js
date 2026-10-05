// Stand-in for src/lib/mapProvider/mapplsSdk.ts in end-to-end tests. It draws
// markers as real DOM elements on a flat map so taps behave like Mappls: a
// marker tap reaches the marker first and then the map.
const CENTER = { lat: 11.0168, lng: 76.9558 };
const PX_PER_DEGREE = 6000;

const state = (window.__fakeMappls = window.__fakeMappls || { fits: [], eases: [], markers: 0 });

function place(el, position, anchor, width, height) {
  const left = `calc(50% + ${(position.lng - CENTER.lng) * PX_PER_DEGREE}px - ${width / 2}px)`;
  const top = `calc(50% - ${(position.lat - CENTER.lat) * PX_PER_DEGREE}px - ${anchor === "bottom" ? height : height / 2}px)`;
  el.style.left = left;
  el.style.top = top;
}

function createMap({ id }) {
  const root = document.getElementById(id);
  root.style.position = "relative";
  root.style.overflow = "hidden";
  root.style.background = "linear-gradient(180deg, #EEF2F7, #E3E8EF)";
  root.dataset.fakeMap = "true";
  const handlers = new Map();
  const emit = (name, event) => (handlers.get(name) || new Set()).forEach((fn) => fn(event));
  root.addEventListener("click", () => emit("click", { lngLat: { lat: CENTER.lat, lng: CENTER.lng } }));
  const map = {
    root,
    on: (name, fn) => {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(fn);
    },
    off: (name, fn) => handlers.get(name)?.delete(fn),
    loaded: () => true,
    resize: () => {},
    remove: () => { root.innerHTML = ""; },
    fitBounds: (bounds, options) => { state.fits.push({ bounds, options }); },
    jumpTo: (options) => { state.fits.push({ jump: options }); },
    easeTo: (options) => { state.eases.push(options); },
    flyTo: () => {},
    setCenter: () => {},
    setZoom: () => {},
    getZoom: () => 14,
  };
  return map;
}

function createMarker({ map, position, html, anchor = "center", width = 30, height = 30, zIndex = 1 }) {
  const el = document.createElement("div");
  el.dataset.fakeMarker = "true";
  el.style.position = "absolute";
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.zIndex = String(zIndex);
  el.innerHTML = html;
  let current = position;
  place(el, current, anchor, width, height);
  map.root.appendChild(el);
  state.markers += 1;
  const listeners = new Map();
  el.addEventListener("click", () => (listeners.get("click") || []).forEach((fn) => fn()));
  return {
    addListener: (name, fn) => listeners.set(name, [...(listeners.get(name) || []), fn]),
    setPosition: (next) => { current = next; place(el, current, anchor, width, height); },
    getPosition: () => current,
    getElement: () => el,
    remove: () => el.remove(),
  };
}

const overlay = () => ({ remove: () => {} });

const runtime = {
  Map: createMap,
  Marker: createMarker,
  Polyline: overlay,
  Circle: overlay,
  removeLayer: ({ layer }) => layer?.remove?.(),
};

const unavailable = () => Promise.reject(new Error("Not available in end-to-end tests"));

export const initializeMapplsSdk = () => Promise.resolve(runtime);
export const initializeMapplsPlaces = unavailable;
export const initializeMapplsTracking = unavailable;
export const searchMapplsPlaces = () => Promise.resolve([]);
export const createMapplsSdkLoader = () => initializeMapplsSdk;
export const createMapplsPlacesLoader = () => unavailable;
export const createMapplsTrackingLoader = () => unavailable;
export const createMapplsPlacesSearch = () => searchMapplsPlaces;
