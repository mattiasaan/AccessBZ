// Avviso che scende dall'alto quando ci si avvicina a un ostacolo (insieme all'avviso vocale).
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../AppContext';
import { CATEGORIES } from '../constants';
import { colors, radius, shadow, space } from '../theme';
import { Icon, PressableScale, T } from './ui';

const AUTO_HIDE_MS = 12000;

export default function ProximityBanner() {
  const { alert, dismissAlert, openReport } = useApp();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-200)).current;
  const [shown, setShown] = useState(null);

  useEffect(() => {
    if (alert) {
      setShown(alert);
      y.setValue(-200);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 180 }).start();
      const t = setTimeout(dismissAlert, AUTO_HIDE_MS);
      return () => clearTimeout(t);
    }
    if (shown) {
      Animated.timing(y, { toValue: -200, duration: 220, useNativeDriver: true }).start(() => setShown(null));
    }
  }, [alert]);

  if (!shown) return null;
  const cat = CATEGORIES[shown.report.category];
  const meters = Math.round(shown.distance);

  return (
    <Animated.View
      style={[styles.wrap, { top: insets.top + 8, transform: [{ translateY: y }] }]}
      accessibilityLiveRegion="assertive"
    >
      <PressableScale
        style={styles.box}
        onPress={() => {
          openReport(shown.report.id);
          dismissAlert();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Attenzione: ${cat?.label} a ${meters} metri. Tocca per aprire.`}
      >
        <View style={styles.iconWrap}>
          <Icon name={cat?.icon} size={26} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="overline" style={{ color: 'rgba(15,23,42,0.7)' }}>
            {shown.ahead ? (meters < 8 ? 'Attenzione · adesso' : `Sul percorso · tra ${meters} m`) : `Attenzione · ${meters} m`}
          </T>
          <T variant="heading">{cat?.label}</T>
          <T variant="caption" style={{ color: 'rgba(15,23,42,0.75)' }}>Tocca per confermare se c’è ancora</T>
        </View>
        <Pressable onPress={dismissAlert} hitSlop={12} accessibilityLabel="Chiudi avviso" style={styles.close}>
          <Icon name="close" size={20} color={colors.text} />
        </Pressable>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md, zIndex: 50 },
  box: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.alert,
    borderRadius: radius.lg, padding: space.md, ...shadow.lg,
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  close: { padding: 4 },
});
