// "Memoria del luogo": cosa è successo in questo punto negli ultimi 30 giorni.
// Trasforma le singole segnalazioni in un dato sulla vivibilità della strada.
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { CATEGORIES } from '../constants';
import { colors, radius, space } from '../theme';
import { t } from '../i18n';
import { formatMinutes } from '../utils';
import { Icon, T } from './ui';

// Fasce di 4 ore
const BUCKETS = [0, 4, 8, 12, 16, 20];

export default function PlaceMemory({ place }) {
  if (!place) return null;

  if (place.count < 2) {
    return (
      <View style={styles.empty}>
        <Icon name="history" size={20} color={colors.textMuted} />
        <T variant="label" style={{ flex: 1 }}>
          {t('place.first', { d: place.days })}
        </T>
      </View>
    );
  }

  // Ora locale del telefono (in Italia) a partire dai timestamp UTC
  const counts = BUCKETS.map(() => 0);
  place.created_at.forEach((iso) => {
    const h = new Date(iso).getHours();
    counts[Math.floor(h / 4)] += 1;
  });
  const max = Math.max(...counts);
  const peak = counts.indexOf(max);

  const [topCat, topN] = Object.entries(place.by_category)[0];
  const top = CATEGORIES[topCat];

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Icon name="history" size={20} color={colors.primary} />
        <T variant="heading" style={{ flex: 1 }}>
          {t('place.count', { n: place.count, d: place.days })}
        </T>
      </View>
      <T variant="caption" style={{ marginBottom: space.md }}>
        {t('place.within', { r: place.radius_m })}
      </T>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <T variant="caption">{t('place.avg')}</T>
          <T variant="bodyMedium">{formatMinutes(place.avg_resolution_minutes)}</T>
        </View>
        <View style={styles.stat}>
          <T variant="caption">{t('place.mostFrequent')}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name={top.icon} size={16} color={top.tint} />
            <T variant="bodyMedium" numberOfLines={1} style={{ flexShrink: 1 }}>
              {top.short} · {topN}
            </T>
          </View>
        </View>
      </View>

      <T variant="caption" style={{ marginTop: space.md, marginBottom: space.sm }}>
        {t('place.when')}
      </T>
      <View
        style={styles.chart}
        accessible
        accessibilityLabel={t('place.peakA11y', { a: BUCKETS[peak], b: BUCKETS[peak] + 4 })}
      >
        {counts.map((n, i) => (
          <Bar key={i} value={max ? n / max : 0} highlight={i === peak} label={`${BUCKETS[i]}`} delay={i * 50} />
        ))}
      </View>
      <T variant="label" style={{ marginTop: space.sm, color: colors.text }}>
        {t('place.usually', { a: BUCKETS[peak], b: BUCKETS[peak] + 4 })}
      </T>
    </View>
  );
}

const BAR_H = 56;

function Bar({ value, highlight, label, delay }) {
  const h = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(h, { toValue: value, duration: 450, delay, useNativeDriver: false }).start();
  }, [value]);
  return (
    <View style={styles.barCol}>
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.bar,
            {
              backgroundColor: highlight ? colors.primary : colors.borderStrong,
              height: h.interpolate({ inputRange: [0, 1], outputRange: [3, BAR_H] }),
            },
          ]}
        />
      </View>
      <T variant="caption" style={{ fontSize: 11 }}>{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  empty: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: space.lg,
  },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md, gap: 2 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { height: BAR_H, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6 },
});
