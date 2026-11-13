// Schermata principale: la mappa dinamica degli ostacoli.
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../AppContext';
import CityMap from '../components/CityMap';
import { Chip, Icon, PressableScale, T } from '../components/ui';
import { CATEGORIES, PROFILES, STATUSES } from '../constants';
import { colors, fonts, radius, shadow, space } from '../theme';

export default function MapScreen({ navigation }) {
  const {
    user, reports, reportsError, refreshReports, position, openReport, openReportId,
    activeRoute, setActiveRoute, simulating, stopSimulation, focusPoint, setFocusPoint,
  } = useApp();
  const [filter, setFilter] = useState(null);

  useFocusEffect(useCallback(() => { refreshReports(); }, [refreshReports]));

  const profile = PROFILES[user.profile];
  const visible = useMemo(
    () => (filter ? reports.filter((r) => r.category === filter) : reports),
    [reports, filter],
  );
  const categoriesHere = useMemo(() => [...new Set(reports.map((r) => r.category))], [reports]);

  const routes = useMemo(
    () => (activeRoute ? [{ id: activeRoute.id, geometry: activeRoute.geometry, color: colors.primary, selected: true }] : []),
    [activeRoute],
  );

  // La barra di navigazione entra dal basso
  const navAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(navAnim, { toValue: activeRoute ? 1 : 0, useNativeDriver: true, damping: 18, stiffness: 160 }).start();
  }, [activeRoute]);

  const endNavigation = () => {
    stopSimulation();
    setActiveRoute(null);
  };

  return (
    <View style={styles.container}>
      <CityMap
        reports={visible}
        routes={routes}
        me={position}
        follow={!!activeRoute}
        focus={focusPoint}
        selectedId={openReportId}
        onMarkerPress={openReport}
        onLongPress={(pick) => navigation.navigate('Segnala', { pick })}
      />

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <View style={styles.header} pointerEvents="box-none">
          <PressableScale
            style={styles.profileCard}
            onPress={() => navigation.navigate('Profilo')}
            accessibilityRole="button"
            accessibilityLabel={`Profilo ${profile.label}. ${reports.length} ostacoli attivi. Tocca per cambiare profilo`}
          >
            <View style={styles.profileIcon}>
              <Icon name={profile.icon} size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="caption">Bolzano · {profile.label}</T>
              <T variant="heading" style={{ fontSize: 16 }}>
                {reports.length} {reports.length === 1 ? 'ostacolo attivo' : 'ostacoli attivi'}
              </T>
            </View>
            <Icon name="chevron-right" size={22} color={colors.textSubtle} />
          </PressableScale>
        </View>

        {categoriesHere.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <Chip label="Tutti" selected={!filter} onPress={() => setFilter(null)} />
            {categoriesHere.map((c) => (
              <Chip
                key={c}
                label={CATEGORIES[c].short}
                icon={CATEGORIES[c].icon}
                color={CATEGORIES[c].tint}
                selected={filter === c}
                onPress={() => setFilter(filter === c ? null : c)}
              />
            ))}
          </ScrollView>
        ) : null}

        {reportsError ? (
          <View style={styles.error}>
            <Icon name="wifi-off" size={18} color={colors.danger} />
            <T variant="label" style={{ color: colors.danger, flex: 1 }}>{reportsError}</T>
          </View>
        ) : null}
      </SafeAreaView>

      <View style={styles.legend} pointerEvents="none">
        {['new', 'confirmed', 'persistent'].map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: STATUSES[s].color }]} />
            <T variant="caption" style={{ color: colors.text }}>{STATUSES[s].label}</T>
          </View>
        ))}
      </View>

      <View style={styles.fabs} pointerEvents="box-none">
        {position ? (
          <PressableScale
            style={styles.locate}
            onPress={() => setFocusPoint({ ...position, zoom: 17, t: Date.now() })}
            accessibilityRole="button"
            accessibilityLabel="Centra la mappa sulla mia posizione"
          >
            <Icon name="crosshairs-gps" size={22} color={colors.primary} />
          </PressableScale>
        ) : null}
        <PressableScale
          style={styles.fab}
          onPress={() => navigation.navigate('Segnala')}
          accessibilityRole="button"
          accessibilityLabel="Segnala un ostacolo"
        >
          <Icon name="plus" size={22} color="#fff" />
          <T variant="heading" style={{ color: '#fff', fontSize: 16 }}>Segnala</T>
        </PressableScale>
      </View>

      <Animated.View
        pointerEvents={activeRoute ? 'auto' : 'none'}
        style={[
          styles.navBar,
          {
            opacity: navAnim,
            transform: [{ translateY: navAnim.interpolate({ inputRange: [0, 1], outputRange: [140, 0] }) }],
          },
        ]}
      >
        <View style={styles.navIcon}>
          <Icon name={simulating ? 'play' : 'navigation-variant'} size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {simulating ? 'Simulazione in corso' : 'Navigazione attiva'}
          </T>
          <T variant="heading" style={{ color: '#fff', fontSize: 15 }}>
            {activeRoute?.obstacles.length
              ? `${activeRoute.obstacles.length} ostacoli sul percorso`
              : 'Nessun ostacolo sul percorso'}
          </T>
        </View>
        <PressableScale onPress={endNavigation} style={styles.navEnd} accessibilityRole="button" accessibilityLabel="Termina navigazione">
          <T variant="heading" style={{ fontSize: 14 }}>Termina</T>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { paddingHorizontal: space.md, paddingTop: space.sm },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: space.md, ...shadow.md,
  },
  profileIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  filters: { paddingHorizontal: space.md, paddingVertical: space.md, gap: space.sm },
  error: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.md,
    backgroundColor: colors.dangerSoft, padding: space.md, borderRadius: radius.md,
  },
  legend: {
    position: 'absolute', left: space.md, bottom: space.lg, backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md, gap: 4, ...shadow.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  fabs: { position: 'absolute', right: space.md, bottom: space.lg, alignItems: 'flex-end', gap: space.md },
  locate: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', ...shadow.md,
  },
  fab: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary,
    borderRadius: radius.pill, paddingHorizontal: 22, height: 56, ...shadow.lg,
  },
  navBar: {
    position: 'absolute', left: space.md, right: space.md, bottom: 140, flexDirection: 'row',
    alignItems: 'center', gap: space.md, backgroundColor: colors.text, borderRadius: radius.lg,
    padding: space.md, ...shadow.lg,
  },
  navIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  navEnd: { backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 9 },
});
