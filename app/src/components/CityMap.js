// Mappa Leaflet (OpenStreetMap) dentro una WebView.
// - I marker vicini si raggruppano in cluster quando si riduce lo zoom (Leaflet.markercluster).
// - Le icone sono Material Design Icons, lo stesso set usato nel resto dell'app.
// React Native invia i dati con injectJavaScript; la mappa risponde con postMessage.
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { CATEGORIES, STATUSES } from '../constants';
import { HTML } from './mapHtml';

/**
 * props:
 *  reports: segnalazioni da mostrare
 *  routes: [{ id, geometry: [[lat, lon]], color, selected }]
 *  me: { lat, lon } posizione dell'utente
 *  follow: se true la mappa segue la posizione
 *  pick: { lat, lon } segnaposto scelto dall'utente
 *  focus: { lat, lon, zoom } punto su cui centrare la mappa
 *  selectedId: id del marker evidenziato
 *  onMarkerPress(id), onLongPress({ lat, lon })
 */
export default function CityMap({
  reports = [], routes = [], me, follow, pick, focus, selectedId, onMarkerPress, onLongPress, style,
}) {
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    const data = {
      reports: reports.map((r) => ({
        id: r.id,
        lat: r.lat,
        lon: r.lon,
        status: r.status,
        icon: CATEGORIES[r.category]?.icon || 'alert-circle-outline',
        color: STATUSES[r.status]?.color || '#64748B',
      })),
      routes,
      me,
      follow,
      pick,
      selectedId,
    };
    ref.current?.injectJavaScript(`window.updateMap(${JSON.stringify(data)}); true;`);
  }, [loaded, reports, routes, me, follow, pick, selectedId]);

  useEffect(() => {
    if (loaded && focus) {
      ref.current?.injectJavaScript(`window.focusOn(${focus.lat}, ${focus.lon}, ${focus.zoom || 17}); true;`);
    }
  }, [loaded, focus]);

  const onMessage = (e) => {
    let msg;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') setLoaded(true);
    else if (msg.type === 'marker') onMarkerPress?.(msg.id);
    else if (msg.type === 'longpress') onLongPress?.({ lat: msg.lat, lon: msg.lon });
  };

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        ref={ref}
        // baseUrl: i server di OpenStreetMap richiedono un "Referer" valido per le tessere della mappa
        source={{ html: HTML, baseUrl: 'https://accessbz.app/' }}
        originWhitelist={['*']}
        // La WebView può mostrare solo la mappa: ogni tentativo di navigare altrove viene bloccato
        onShouldStartLoadWithRequest={(req) =>
          req.url.startsWith('https://accessbz.app') || req.url.startsWith('about:') || req.url.startsWith('data:')
        }
        setSupportMultipleWindows={false}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        bounces={false}
        overScrollMode="never"
        allowsLinkPreview={false}
        textInteractionEnabled={false}
        style={styles.web}
        accessibilityLabel="Mappa della città con gli ostacoli segnalati"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#EEF0F3' },
  web: { flex: 1, backgroundColor: '#EEF0F3' },
});
