// Profilo: profilo di mobilità, voce, impatto personale e cittadino, privacy.
import { useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../api';
import { useApp } from '../AppContext';
import { Button, Card, Divider, FadeIn, Icon, IconBadge, OptionCard, SectionHeader, T } from '../components/ui';
import { CATEGORIES, PROFILES, SHOW_ACCOUNT_RESET } from '../constants';
import { colors, radius, shadow, space } from '../theme';
import { formatMinutes } from '../utils';

export default function ProfileScreen() {
  const { user, deviceId, setProfile, settings, updateSettings, resetAccount } = useApp();
  const [me, setMe] = useState(null);
  const [city, setCity] = useState(null);

  useFocusEffect(
    useCallback(() => {
      api.myStats(deviceId).then(setMe).catch(() => setMe(null));
      api.cityStats().then(setCity).catch(() => setCity(null));
    }, [deviceId]),
  );

  const changeProfile = async (p) => {
    try {
      await setProfile(p);
    } catch (e) {
      Alert.alert('Errore', e.message);
    }
  };

  const name = user.nickname;

  const confirmReset = () =>
    Alert.alert(
      'Reset account?',
      'Torni alla schermata iniziale e potrai entrare come un nuovo utente. Le segnalazioni già pubblicate restano sulla mappa.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => resetAccount() },
      ],
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <FadeIn>
          <View style={styles.hero}>
            <View style={styles.avatar}>
              <T variant="title" style={{ color: '#fff' }}>{name.slice(0, 1).toUpperCase()}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="title" accessibilityRole="header">{name}</T>
              <T variant="label">{PROFILES[user.profile].label}</T>
            </View>
          </View>
        </FadeIn>

        {me ? (
          <FadeIn delay={60}>
            <View style={styles.kpis}>
              <Kpi value={me.total} label="Segnalazioni" />
              <Kpi value={me.resolved} label="Risolte" />
              <Kpi value={me.confirmed_by_community} label="Conferme ricevute" />
            </View>
          </FadeIn>
        ) : null}

        <SectionHeader title="Profilo di mobilità" subtitle="Cambia gli ostacoli mostrati e il tipo di percorso." />
        {Object.entries(PROFILES).map(([key, p]) => (
          <OptionCard
            key={key}
            icon={p.icon}
            label={p.label}
            hint={p.hint}
            selected={user.profile === key}
            onPress={() => changeProfile(key)}
          />
        ))}

        <SectionHeader title="Assistente vocale" />
        <Card style={{ padding: 0 }}>
          <View style={styles.settingRow}>
            <IconBadge name="volume-high" size={38} />
            <View style={{ flex: 1 }}>
              <T variant="bodyMedium">Avvisi vocali</T>
              <T variant="caption">Ti avvisa quando sei vicino a un ostacolo</T>
            </View>
            <Switch
              value={settings.voice}
              onValueChange={(voice) => updateSettings({ voice })}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#fff"
              accessibilityLabel="Avvisi vocali"
            />
          </View>
          <Divider style={{ marginLeft: 66 }} />
          <Button
            title="Prova la voce"
            icon="play-circle-outline"
            variant="ghost"
            onPress={() => Speech.speak('Attenzione. Veicolo sul marciapiede a circa 20 metri.', { language: 'it-IT' })}
          />
        </Card>

        {me ? (
          <>
            <SectionHeader title="Il mio impatto" />
            <Card style={{ padding: 0 }}>
              <StatRow icon="account-check-outline" label="Conferme date" value={me.votes_given} />
              <Divider style={{ marginLeft: 66 }} />
              <StatRow icon="timer-outline" label="Durata media dei miei ostacoli" value={formatMinutes(me.avg_resolution_minutes)} />
              {Object.entries(me.by_category).map(([c, n]) => (
                <View key={c}>
                  <Divider style={{ marginLeft: 66 }} />
                  <StatRow icon={CATEGORIES[c]?.icon} color={CATEGORIES[c]?.tint} label={CATEGORIES[c]?.label} value={n} />
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {city ? (
          <>
            <SectionHeader title="Accessibilità Bolzano adesso" />
            <View style={styles.kpis}>
              <Kpi value={city.active} label="Ostacoli attivi" tone={colors.danger} />
              <Kpi value={city.resolved} label="Risolti" tone={colors.success} />
              <Kpi value={formatMinutes(city.avg_resolution_minutes)} label="Durata media" small />
            </View>
            {Object.keys(city.active_by_category).length ? (
              <Card style={{ padding: 0 }}>
                {Object.entries(city.active_by_category).map(([c, n], i) => (
                  <View key={c}>
                    {i ? <Divider style={{ marginLeft: 66 }} /> : null}
                    <StatRow icon={CATEGORIES[c]?.icon} color={CATEGORIES[c]?.tint} label={CATEGORIES[c]?.label} value={n} />
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        ) : null}

        <SectionHeader title="Privacy" />
        <View style={styles.privacy}>
          <Icon name="shield-lock-outline" size={20} color={colors.textMuted} />
          <T variant="label" style={{ flex: 1 }}>
            Nessuna email o password. La tua posizione non viene mai salvata né condivisa: inviamo solo la
            posizione dell’ostacolo quando pubblichi una segnalazione. Puoi eliminare le tue segnalazioni
            dalla loro scheda.
          </T>
        </View>
        {SHOW_ACCOUNT_RESET ? (
          <>
            <SectionHeader title="Sviluppo" subtitle="Da rimuovere prima della versione finale." />
            <Button
              title="Reset account"
              icon="logout-variant"
              variant="secondary"
              onPress={confirmReset}
              accessibilityLabel="Reset account: torna alla schermata iniziale con un nuovo utente"
            />
          </>
        ) : null}

        <T variant="caption" style={{ marginTop: space.lg, textAlign: 'center', color: colors.textSubtle }}>
          Mappe © OpenStreetMap contributors · Percorsi openrouteservice.org
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({ value, label, tone = colors.text, small }) {
  return (
    <View style={styles.kpi} accessible accessibilityLabel={`${label}: ${value}`}>
      <T variant="title" style={[{ color: tone }, small && { fontSize: 18, lineHeight: 30 }]} numberOfLines={1} adjustsFontSizeToFit>
        {value ?? '—'}
      </T>
      <T variant="caption">{label}</T>
    </View>
  );
}

function StatRow({ icon, color = colors.primary, label, value }) {
  return (
    <View style={styles.settingRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <IconBadge name={icon} color={color} size={38} />
      <T variant="body" style={{ flex: 1 }}>{label}</T>
      <T variant="heading">{value ?? '—'}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, paddingBottom: 48 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: {
    width: 60, height: 60, borderRadius: 20, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', ...shadow.md,
  },
  kpis: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, marginBottom: space.sm },
  kpi: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, ...shadow.sm },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  privacy: {
    flexDirection: 'row', gap: space.md, alignItems: 'flex-start',
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md,
  },
});
