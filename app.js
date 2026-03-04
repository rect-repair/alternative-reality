// Stadia Maps API key?
const STADIA_API_KEY = ''; // leave empty to disable Stamen styles

// Map styles
const mapStyles = [
    // CARTO styles
    {
        name: 'CARTO Dark',
        tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
        attribution: '© CARTO © OpenStreetMap'
    },
    {
        name: 'CARTO Light',
        tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'],
        attribution: '© CARTO © OpenStreetMap'
    },
    {
        name: 'CARTO Voyager',
        tiles: ['https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'],
        attribution: '© CARTO © OpenStreetMap'
    },
    // Stamen styles
    ...(STADIA_API_KEY ? [
        {
            name: 'Stamen Toner',
            tiles: [`https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}@2x.png?api_key=${STADIA_API_KEY}`],
            attribution: '© Stadia Maps © Stamen Design © OpenStreetMap'
        },
        {
            name: 'Stamen Toner Lite',
            tiles: [`https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}@2x.png?api_key=${STADIA_API_KEY}`],
            attribution: '© Stadia Maps © Stamen Design © OpenStreetMap'
        },
        {
            name: 'Stamen Terrain',
            tiles: [`https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}@2x.png?api_key=${STADIA_API_KEY}`],
            attribution: '© Stadia Maps © Stamen Design © OpenStreetMap'
        },
    ] : []),
];
let currentStyleIndex = 0;

// Active (non-pending) nodes for map features
const activeNodes = NODES.filter(n => !n.pending);

// Get line coordinates, handling antimeridian crossing for shortest visual path
function getLineCoords(coord1, coord2) {
    let lon1 = coord1[0];
    let lon2 = coord2[0];
    const lat1 = coord1[1];
    const lat2 = coord2[1];

    const directDiff = Math.abs(lon2 - lon1);
    const wrapDiff = 360 - directDiff;

    if (wrapDiff < directDiff) {
        if (lon2 > lon1) {
            lon2 -= 360;
        } else {
            lon2 += 360;
        }
    }

    return [[lon1, lat1], [lon2, lat2]];
}

// Initialize map with CARTO Dark
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            'carto-dark': {
                type: 'raster',
                tiles: [
                    'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
                ],
                tileSize: 256,
                attribution: '© CARTO © OpenStreetMap'
            }
        },
        layers: [{
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 19
        }]
    },
    center: [30, 35],
    zoom: 1.8,
    maxZoom: 18,
    minZoom: 1
});

const popups = {};

// Overlay data
const connectionFeatures = [];
for (let i = 0; i < activeNodes.length; i++) {
    for (let j = i + 1; j < activeNodes.length; j++) {
        const coords = getLineCoords(activeNodes[i].coords, activeNodes[j].coords);
        connectionFeatures.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords }
        });
    }
}

const nodeFeatures = activeNodes.map(loc => ({
    type: 'Feature',
    properties: { id: loc.id, name: loc.city, org: loc.org },
    geometry: { type: 'Point', coordinates: loc.coords }
}));

// Animation state
let pulsePhase = 0;
let animationRunning = false;

function animatePulse() {
    if (!map.getLayer('node-glow')) return;
    pulsePhase += 0.05;
    const radius = 15 + Math.sin(pulsePhase) * 8;
    const opacity = 0.3 + Math.sin(pulsePhase) * 0.2;
    map.setPaintProperty('node-glow', 'circle-radius', radius);
    map.setPaintProperty('node-glow', 'circle-opacity', Math.max(0.1, opacity));
    requestAnimationFrame(animatePulse);
}

// Add overlays function - called on every style load
function addOverlays() {
    try {
        // Add connections source and layer
        map.addSource('connections', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: connectionFeatures }
        });

        map.addLayer({
            id: 'connection-lines',
            type: 'line',
            source: 'connections',
            paint: {
                'line-color': '#0000ff',
                'line-width': 2,
                'line-dasharray': [2, 2],
                'line-opacity': 0.8
            }
        });

        // Add nodes source and layers
        map.addSource('nodes', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: nodeFeatures }
        });

        map.addLayer({
            id: 'node-glow',
            type: 'circle',
            source: 'nodes',
            paint: {
                'circle-radius': 15,
                'circle-color': '#ccff00ff',
                'circle-opacity': 0.4,
                'circle-blur': 0.8
            }
        });

        map.addLayer({
            id: 'node-markers',
            type: 'circle',
            source: 'nodes',
            paint: {
                'circle-radius': 5,
                'circle-color': '#f2ff00ff',
                'circle-stroke-width': 3,
                'circle-stroke-color': '#0022ffff'
            }
        });

        console.log('Overlays added successfully');
    } catch (e) {
        console.error('Error adding overlays:', e);
    }

    // Start animation if not running
    if (!animationRunning) {
        animationRunning = true;
        animatePulse();
    }
}

// Create popups for active nodes
activeNodes.forEach(loc => {
    const orgHtml = loc.url
        ? `<a href="${loc.url}" target="_blank">${loc.org}</a>`
        : (loc.org || 'TBD');
    popups[loc.id] = new maplibregl.Popup({
        offset: 15,
        closeButton: true,
        closeOnClick: false
    }).setHTML(`
        <div class="marker-popup">
            <h4>${loc.city}</h4>
            <div class="org">${orgHtml}</div>
            <div class="coord">${loc.coords[1].toFixed(4)}°, ${loc.coords[0].toFixed(4)}°</div>
        </div>
    `);
});

// Render sidebar nodes list from NODES data
function renderSidebar() {
    const list = document.getElementById('nodes-list');
    if (!list) return;
    list.innerHTML = NODES.map(node => `
        <li class="location-item${node.pending ? ' pending' : ''}" data-city="${node.id}">
            <div class="location-dot"></div>
            <div class="location-info">
                <div class="location-city">${node.city}</div>
                <div class="location-org">hosted by ${node.org || 'TBD'}</div>
            </div>
            <div class="location-tz">${node.tz}</div>
        </li>
    `).join('');

    list.querySelectorAll('.location-item').forEach(item => {
        item.addEventListener('click', () => {
            const cityId = item.dataset.city;
            const loc = NODES.find(l => l.id === cityId);
            if (loc && !loc.pending) {
                Object.values(popups).forEach(p => p.remove());
                map.flyTo({ center: loc.coords, zoom: 6, duration: 2000 });
                setTimeout(() => {
                    popups[cityId].setLngLat(loc.coords).addTo(map);
                }, 2000);
            }
        });
    });
}

renderSidebar();

// Add overlays on initial map load
map.on('load', () => {
    console.log('Initial map load, adding overlays...');
    addOverlays();
});

// Click on markers
map.on('click', 'node-markers', (e) => {
    const props = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates.slice();
    Object.values(popups).forEach(p => p.remove());
    popups[props.id].setLngLat(coords).addTo(map);
});

// Hover cursor
map.on('mouseenter', 'node-markers', () => {
    map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'node-markers', () => {
    map.getCanvas().style.cursor = '';
});

// Coordinate display
map.on('mousemove', (e) => {
    const el = document.getElementById('hover-coord');
    if (el) el.textContent = `${e.lngLat.lat.toFixed(4)}°, ${e.lngLat.lng.toFixed(4)}°`;
});

// Time update
function updateTime() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const el = document.getElementById('current-time');
    if (el) el.textContent = time;
}
updateTime();
setInterval(updateTime, 1000);
