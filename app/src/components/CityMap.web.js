// Versione web della mappa (solo per provare l'app nel browser): stessa pagina Leaflet in un iframe.
import { createElement, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CATEGORIES, STATUSES } from '../constants';
import { HTML } from './mapHtml';

const SHIM =
  '<script>window.ReactNativeWebView={postMessage:function(m){parent.postMessage({__accessbz:m},"*")}};</script>';
const DOC = HTML.replace('<head>', '<head>' + SHIM);

export default function CityMap({
  reports = [], routes = [], me, follow, pick, focus, selectedId, onMarkerPress, onLongPress, style,
}) {
  const frame = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const handlers = useRef({});
  handlers.current = { onMarkerPress, onLongPress };

  useEffect(() => {
    const onMsg = (e) => {
      if (e.source !== frame.current?.contentWindow || !e.data?.__accessbz) return;
      const msg = JSON.parse(e.data.__accessbz);
      if (msg.type === 'ready') setLoaded(true);
      else if (msg.type === 'marker') handlers.current.onMarkerPress?.(msg.id);
      else if (msg.type === 'longpress') handlers.current.onLongPress?.({ lat: msg.lat, lon: msg.lon });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    frame.current.contentWindow.updateMap({
      reports: reports.map((r) => ({
        id: r.id, lat: r.lat, lon: r.lon, status: r.status,
        icon: CATEGORIES[r.category]?.icon || 'alert-circle-outline',
        color: STATUSES[r.status]?.color || '#64748B',
      })),
      routes, me, follow, pick, selectedId,
    });
  }, [loaded, reports, routes, me, follow, pick, selectedId]);

  useEffect(() => {
    if (loaded && focus) frame.current.contentWindow.focusOn(focus.lat, focus.lon, focus.zoom || 17);
  }, [loaded, focus]);

  return (
    <View style={[styles.wrap, style]}>
      {createElement('iframe', {
        ref: frame,
        srcDoc: DOC,
        title: 'Mappa',
        style: { border: 0, width: '100%', height: '100%' },
      })}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#EEF0F3' } });
