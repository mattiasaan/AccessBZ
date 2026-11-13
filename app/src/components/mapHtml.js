// Pagina HTML della mappa Leaflet, condivisa tra app (WebView) e web (iframe).
import { BZ_CENTER } from '../constants';

export const HTML = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<style>
  /* Niente selezione del testo / menu "copia" con la pressione lunga (iOS) */
  * { -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; -webkit-tap-highlight-color:transparent; }
  html,body,#map { margin:0; height:100%; width:100%; background:#EEF0F3; font-family:-apple-system,system-ui,sans-serif; }
  /* Mappa di base più tenue: i marker risaltano meglio */
  .leaflet-tile-pane { filter: saturate(.45) brightness(1.04) contrast(.92); }
  .leaflet-control-attribution { font-size:9px; background:rgba(255,255,255,.7)!important; }

  .obs { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center;
         color:#fff; font-size:20px; border:2.5px solid #fff; box-sizing:border-box;
         box-shadow:0 3px 10px rgba(15,23,42,.28); animation:pop .35s cubic-bezier(.2,1.4,.4,1) both; }
  .obs.sel { transform:scale(1.18); box-shadow:0 0 0 6px rgba(36,87,230,.25),0 4px 12px rgba(15,23,42,.3); }
  @keyframes pop { from { transform:scale(.3); opacity:0 } to { transform:scale(1); opacity:1 } }

  .cl { border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff;
        font-weight:700; font-size:14px; border:3px solid #fff; box-sizing:border-box;
        box-shadow:0 0 0 6px rgba(15,23,42,.08),0 3px 10px rgba(15,23,42,.25); animation:pop .3s ease-out both; }
  .marker-cluster-anim .leaflet-marker-icon, .marker-cluster-anim .leaflet-marker-shadow {
    transition: transform .3s ease-out, opacity .3s ease-in; }

  .me { width:18px; height:18px; border-radius:50%; background:#2457E6; border:3px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,.3); position:relative; box-sizing:border-box; }
  .me:after { content:''; position:absolute; left:-12px; top:-12px; width:36px; height:36px; border-radius:50%;
              background:rgba(36,87,230,.25); animation:pulse 2s ease-out infinite; }
  @keyframes pulse { from { transform:scale(.4); opacity:1 } to { transform:scale(1.6); opacity:0 } }

  .pin { color:#2457E6; font-size:38px; line-height:38px; text-shadow:0 3px 6px rgba(0,0,0,.25);
         animation:drop .4s cubic-bezier(.2,1.3,.4,1) both; }
  @keyframes drop { from { transform:translateY(-30px); opacity:0 } to { transform:none; opacity:1 } }
</style></head><body><div id="map"></div>
<script>
  const send = (m) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m));
  const map = L.map('map', { zoomControl:false, tapHold:true, attributionControl:true })
    .setView([${BZ_CENTER.lat}, ${BZ_CENTER.lon}], 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin',
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  // Il colore del cluster è quello dello stato più grave al suo interno
  const RANK = { new:1, confirmed:2, persistent:3 };
  const cluster = L.markerClusterGroup({
    showCoverageOnHover:false, spiderfyOnMaxZoom:true, disableClusteringAtZoom:18, maxClusterRadius:55,
    iconCreateFunction: (c) => {
      const kids = c.getAllChildMarkers();
      let worst = kids[0].options.data;
      kids.forEach((k) => { if ((RANK[k.options.data.status]||0) > (RANK[worst.status]||0)) worst = k.options.data; });
      const n = c.getChildCount(), size = n < 5 ? 40 : n < 15 ? 46 : 54;
      return L.divIcon({ className:'', iconSize:[size,size],
        html:'<div class="cl" style="width:'+size+'px;height:'+size+'px;background:'+worst.color+'">'+n+'</div>' });
    }
  }).addTo(map);
  const routeLayer = L.layerGroup().addTo(map);
  let me = null, pick = null, lastRouteKey = null, lastLong = 0, selectedId = null;
  let lastReportsKey = null, lastRoutesDrawn = null;

  // tapHold genera "contextmenu" anche su iOS; Android lo genera da solo: evitiamo i doppioni
  map.on('contextmenu', (e) => {
    const now = Date.now(); if (now - lastLong < 800) return; lastLong = now;
    send({ type:'longpress', lat:e.latlng.lat, lon:e.latlng.lng });
  });

  function obsIcon(r) {
    return L.divIcon({ className:'', iconSize:[36,36], iconAnchor:[18,18],
      html:'<div class="obs'+(r.id===selectedId?' sel':'')+'" style="background:'+r.color+'"><i class="mdi mdi-'+r.icon+'"></i></div>' });
  }

  window.updateMap = function (d) {
    selectedId = d.selectedId || null;
    // Ricostruiamo i marker solo se i dati sono cambiati (non a ogni movimento del GPS)
    const reportsKey = JSON.stringify(d.reports || []) + '|' + selectedId;
    if (reportsKey !== lastReportsKey) {
      lastReportsKey = reportsKey;
      cluster.clearLayers();
      cluster.addLayers((d.reports || []).map((r) =>
        L.marker([r.lat, r.lon], { icon: obsIcon(r), data: r })
          .on('click', () => send({ type:'marker', id:r.id }))
      ));
    }

    const routeKey = JSON.stringify((d.routes || []).map((r) => r.id + r.geometry.length));
    const drawnKey = JSON.stringify((d.routes || []).map((r) => [r.id, r.geometry.length, r.color, r.selected]));
    if (drawnKey !== lastRoutesDrawn) {
      lastRoutesDrawn = drawnKey;
      routeLayer.clearLayers();
      (d.routes || []).slice().sort((a, b) => a.selected - b.selected).forEach((r) => {
        L.polyline(r.geometry, { color:'#fff', weight:r.selected ? 10 : 7, opacity:.95, lineCap:'round' }).addTo(routeLayer);
        L.polyline(r.geometry, { color:r.color, weight:r.selected ? 6 : 4, opacity:r.selected ? 1 : .5,
          lineCap:'round', dashArray:r.selected ? null : '2 9' }).addTo(routeLayer);
      });
    }
    if (d.routes && d.routes.length && routeKey !== lastRouteKey) {
      map.fitBounds(d.routes.flatMap((r) => r.geometry), { padding:[48, 48], animate:true });
    }
    lastRouteKey = routeKey;

    if (d.me) {
      if (!me) me = L.marker([d.me.lat, d.me.lon], { interactive:false, zIndexOffset:1000,
        icon:L.divIcon({ className:'', html:'<div class="me"></div>', iconSize:[18,18], iconAnchor:[9,9] }) }).addTo(map);
      else me.setLatLng([d.me.lat, d.me.lon]);
      if (d.follow) map.panTo([d.me.lat, d.me.lon], { animate:true, duration:.8 });
    } else if (me) { map.removeLayer(me); me = null; }

    if (pick) { map.removeLayer(pick); pick = null; }
    if (d.pick) {
      pick = L.marker([d.pick.lat, d.pick.lon], { interactive:false,
        icon:L.divIcon({ className:'', html:'<i class="mdi mdi-map-marker pin"></i>', iconSize:[38,38], iconAnchor:[19,36] }) }).addTo(map);
    }
  };

  window.focusOn = function (lat, lon, zoom) { map.flyTo([lat, lon], zoom || map.getZoom(), { duration:.8 }); };
  send({ type:'ready' });
</script></body></html>`;
