// Percorso personalizzato: confronto A (più veloce) / B (senza ostacoli) e anteprima.
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../api';
import { useApp } from '../AppContext';
import CityMap from '../components/CityMap';
import { Button, Card, Divider, FadeIn, Icon, IconBadge, PressableScale, SectionHeader, T } from '../components/ui';
import { BZ_CENTER, CATEGORIES, PROFILES } from '../constants';
import { colors, fonts, radius, shadow, space } from '../theme';
import { formatDistance, inRegion } from '../utils';

// Partenza della demo del percorso quando il GPS è fuori dal Trentino-Alto Adige
const DEMO_START = { ...BZ_CENTER, label: 'Piazza Walther (demo)' };
const ROUTE_COLORS = { clean: '#15803D', blocked: '#DC2626' };

export default function RouteScreen({ navigation }) {
  const { user, gpsPosition, setActiveRoute, startSimulation, stopSimulation } = useApp();

  // Se il GPS è fuori dal Trentino-Alto Adige si parte da Piazza Walther (Bolzano)
  const gpsInRegion = inRegion(gpsPosition);
  const [useGps, setUseGps] = useState(true);
  const start = useGps && gpsInRegion ? { ...gpsPosition, label: 'La mia posizione' } : DEMO_START;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [destination, setDestination] = useState(null);
  const [routes, setRoutes] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const r = await api.geocode(query.trim(), start);
      setResults(r);
      if (!r.length) Alert.alert('Nessun risultato', 'Prova con un altro nome o indirizzo.');
    } catch (e) {
      Alert.alert('Ricerca non riuscita', e.message);
    } finally {
      setLoading(false);
    }
  };

  const calculate = async (dest) => {
    setDestination(dest);
    setQuery(dest.label);
    setResults([]);
    setRoutes(null);
    setLoading(true);
    try {
      const res = await api.route(start, dest, user.profile);
      setRoutes(res.routes);
      // Selezioniamo il percorso con meno ostacoli
      const best = [...res.routes].sort((a, b) => a.obstacles.length - b.obstacles.length)[0];
      setSelected(best.id);
    } catch (e) {
      Alert.alert('Percorso non disponibile', e.message);
    } finally {
      setLoading(false);
    }
  };

  const chosen = routes?.find((r) => r.id === selected);
  const mapRoutes = useMemo(
    () =>
      (routes || []).map((r) => ({
        id: r.id,
        geometry: r.geometry,
        color: r.obstacles.length ? ROUTE_COLORS.blocked : ROUTE_COLORS.clean,
        selected: r.id === selected,
      })),
    [routes, selected],
  );

  const go = (simulate) => {
    stopSimulation();
    setActiveRoute(chosen);
    if (simulate) startSimulation(chosen.geometry);
    navigation.navigate('Mappa');
  };

  const profile = PROFILES[user.profile];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FadeIn>
            <T variant="title" accessibilityRole="header">Dove vuoi andare?</T>
            <View style={styles.profileTag}>
              <Icon name={profile.icon} size={16} color={colors.primary} />
              <T variant="label" style={{ color: colors.primaryDark }}>Percorso per {profile.label.toLowerCase()}</T>
            </View>
          </FadeIn>

          <FadeIn delay={80}>
            <Card style={{ padding: 0, marginTop: space.lg }}>
              <View style={styles.endpoint}>
                <View style={styles.pointSlot}>
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="caption">Partenza</T>
                  <T variant="bodyMedium">{start.label}</T>
                </View>
                {gpsInRegion ? (
                  <PressableScale onPress={() => setUseGps(!useGps)} accessibilityRole="button" accessibilityLabel="Cambia partenza">
                    <Icon name="swap-horizontal" size={22} color={colors.primary} />
                  </PressableScale>
                ) : null}
              </View>
              <View style={styles.connector} />
              <Divider style={{ marginLeft: space.lg + 24 + space.md }} />
              <View style={styles.endpoint}>
                <View style={styles.pointSlot}>
                  <Icon name="map-marker" size={22} color={colors.danger} />
                </View>
                <TextInput
                  value={query}
                  onChangeText={(t) => {
                    setQuery(t);
                    setDestination(null);
                  }}
                  onSubmitEditing={search}
                  returnKeyType="search"
                  placeholder="Farmacia, Via Museo, ospedale…"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                  accessibilityLabel="Destinazione"
                />
                <PressableScale onPress={search} style={styles.searchBtn} accessibilityRole="button" accessibilityLabel="Cerca">
                  <Icon name="magnify" size={20} color="#fff" />
                </PressableScale>
              </View>
            </Card>
            {!gpsInRegion ? (
              <T variant="caption" style={{ marginTop: -4, marginBottom: space.sm }}>
                Sei fuori dal Trentino-Alto Adige: per la demo si parte dal centro di Bolzano.
              </T>
            ) : null}
          </FadeIn>

          {results.length ? (
            <Card style={{ paddingVertical: space.xs }}>
              {results.map((r, i) => (
                <FadeIn key={i} delay={i * 40}>
                  <PressableScale style={styles.result} onPress={() => calculate(r)} accessibilityRole="button">
                    <Icon name="map-marker-outline" size={20} color={colors.textMuted} />
                    <T variant="body" style={{ flex: 1 }} numberOfLines={2}>{r.label}</T>
                  </PressableScale>
                  {i < results.length - 1 ? <Divider /> : null}
                </FadeIn>
              ))}
            </Card>
          ) : null}

          {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ margin: space.xl }} /> : null}

          {routes ? (
            <FadeIn>
              <View style={styles.mapBox}>
                <CityMap routes={mapRoutes} reports={chosen?.obstacles || []} />
              </View>

              <SectionHeader title="Scegli il percorso" />
              {routes.map((r, i) => {
                const sel = selected === r.id;
                const clean = r.obstacles.length === 0;
                return (
                  <PressableScale
                    key={r.id}
                    onPress={() => setSelected(r.id)}
                    style={[styles.routeCard, sel && styles.routeSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sel }}
                    accessibilityLabel={`Percorso ${String.fromCharCode(65 + i)}, ${Math.round(r.duration_s / 60)} minuti, ${r.obstacles.length} ostacoli`}
                  >
                    <IconBadge
                      name={clean ? 'check-circle-outline' : 'alert-outline'}
                      color={clean ? ROUTE_COLORS.clean : ROUTE_COLORS.blocked}
                      size={44}
                    />
                    <View style={{ flex: 1 }}>
                      <T variant="caption">Percorso {String.fromCharCode(65 + i)} · {r.label}</T>
                      <T variant="heading">
                        {Math.max(1, Math.round(r.duration_s / 60))} min
                        <T variant="body" style={{ color: colors.textMuted }}>  ·  {formatDistance(r.distance_m)}</T>
                      </T>
                      <T variant="label" style={{ color: clean ? ROUTE_COLORS.clean : ROUTE_COLORS.blocked }}>
                        {clean ? 'Nessun ostacolo conosciuto' : `${r.obstacles.length} ostacoli sul percorso`}
                      </T>
                    </View>
                    <View style={[styles.radio, sel && styles.radioOn]}>
                      {sel ? <View style={styles.radioDot} /> : null}
                    </View>
                  </PressableScale>
                );
              })}
              {routes.length === 1 ? (
                <T variant="label" style={{ marginBottom: space.sm }}>
                  {routes[0].obstacles.length === 0
                    ? 'Il percorso più veloce è già libero da ostacoli segnalati.'
                    : 'Non esiste un’alternativa che eviti tutti gli ostacoli.'}
                </T>
              ) : null}

              {chosen ? (
                <>
                  <SectionHeader title="Cosa troverò lungo il percorso?" />
                  <Card>
                    <Step icon="home-outline" color={colors.primary} text="Partenza" />
                    {chosen.obstacles.length === 0 ? (
                      <Step icon="check" color={ROUTE_COLORS.clean} text="Nessun ostacolo conosciuto" />
                    ) : null}
                    {chosen.obstacles.map((o) => (
                      <Step
                        key={o.id}
                        icon={CATEGORIES[o.category]?.icon}
                        color={CATEGORIES[o.category]?.tint}
                        text={CATEGORIES[o.category]?.label}
                        sub={`dopo ${formatDistance(o.distance_along_m)}`}
                      />
                    ))}
                    <Step icon="flag-checkered" color={colors.text} text="Destinazione" last />
                  </Card>
                  <Button title="Avvia navigazione" icon="navigation-variant" onPress={() => go(false)} />
                  <Button
                    title="Simula il tragitto"
                    icon="play"
                    variant="soft"
                    onPress={() => go(true)}
                    style={{ marginTop: space.sm }}
                  />
                </>
              ) : null}
            </FadeIn>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Step({ icon, color, text, sub, last }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepRail}>
        <View style={[styles.stepIcon, { backgroundColor: color + '1A' }]}>
          <Icon name={icon} size={16} color={color} />
        </View>
        {!last ? <View style={styles.stepLine} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : space.md, paddingTop: 5 }}>
        <T variant="bodyMedium">{text}</T>
        {sub ? <T variant="caption">{sub}</T> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, paddingBottom: 48 },
  profileTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: space.sm,
    backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5,
  },
  endpoint: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  // Stessa larghezza per il pallino di partenza e l'icona di arrivo: restano allineati e non tagliati
  pointSlot: { width: 24, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff', ...shadow.sm },
  connector: { position: 'absolute', left: space.lg + 11, top: 44, width: 2, height: 24, backgroundColor: colors.border },
  input: { flex: 1, fontSize: 15, fontFamily: fonts.medium, color: colors.text, paddingVertical: 8 },
  searchBtn: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  mapBox: { height: 260, borderRadius: radius.lg, overflow: 'hidden', marginTop: space.sm, ...shadow.sm },
  routeCard: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.surface, padding: space.md,
    marginBottom: space.sm, ...shadow.sm,
  },
  routeSelected: { borderColor: colors.primary },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  step: { flexDirection: 'row', gap: space.md },
  stepRail: { alignItems: 'center', width: 32 },
  stepIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, flex: 1, minHeight: 12, backgroundColor: colors.border, marginVertical: 3 },
});
