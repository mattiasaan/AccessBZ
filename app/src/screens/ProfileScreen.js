// Profilo: profilo di mobilità, voce, impatto personale e cittadino, privacy.
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../api';
import { useApp } from '../AppContext';
import { Button, Card, Divider, FadeIn, Icon, IconBadge, LanguageSwitch, OptionCard, SectionHeader, T } from '../components/ui';
import { CATEGORIES, PROFILES, SHOW_ACCOUNT_RESET } from '../constants';
import { t } from '../i18n';
import { colors, radius, shadow, space } from '../theme';
import { speak } from '../speech';
import { formatMinutes } from '../utils';

export default function ProfileScreen() {
  const { user, deviceId, setProfile, settings, updateSettings, resetAccount, language } = useApp();
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
      Alert.alert(t('common.error'), e.message);
    }
  };

  const name = user.nickname;

  const confirmReset = () =>
    Alert.alert(
      t('prof.resetTitle'),
      t('prof.resetMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('prof.reset'), style: 'destructive', onPress: () => resetAccount() },
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
              <Kpi value={me.total} label={t('prof.kpiReports')} />
              <Kpi value={me.resolved} label={t('prof.kpiResolved')} />
              <Kpi value={me.confirmed_by_community} label={t('prof.kpiConfirms')} />
            </View>
          </FadeIn>
        ) : null}

        <SectionHeader title={t('prof.mobility')} subtitle={t('prof.mobilitySub')} />
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

        <SectionHeader title={t('common.language')} />
        <LanguageSwitch value={language} onChange={(l) => updateSettings({ language: l })} />

        <SectionHeader title={t('prof.voiceAssistant')} />
        <Card style={{ padding: 0 }}>
          <View style={styles.settingRow}>
            <IconBadge name="volume-high" size={38} />
            <View style={{ flex: 1 }}>
              <T variant="bodyMedium">{t('prof.voiceAlerts')}</T>
              <T variant="caption">{t('prof.voiceAlertsSub')}</T>
            </View>
            <Switch
              value={settings.voice}
              onValueChange={(voice) => updateSettings({ voice })}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#fff"
              accessibilityLabel={t('prof.voiceAlerts')}
            />
          </View>
          <Divider style={{ marginLeft: 66 }} />
          <Button
            title={t('prof.tryVoice')}
            icon="play-circle-outline"
            variant="ghost"
            onPress={() => speak(t('voice.test'))}
          />
        </Card>

        {me ? (
          <>
            <SectionHeader title={t('prof.impact')} />
            <Card style={{ padding: 0 }}>
              <StatRow icon="account-check-outline" label={t('prof.votesGiven')} value={me.votes_given} />
              <Divider style={{ marginLeft: 66 }} />
              <StatRow icon="timer-outline" label={t('prof.avgMine')} value={formatMinutes(me.avg_resolution_minutes)} />
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
            <SectionHeader title={t('prof.cityNow')} />
            <View style={styles.kpis}>
              <Kpi value={city.active} label={t('prof.activeObs')} tone={colors.danger} />
              <Kpi value={city.resolved} label={t('prof.resolvedObs')} tone={colors.success} />
              <Kpi value={formatMinutes(city.avg_resolution_minutes)} label={t('prof.avg')} small />
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

        <SectionHeader title={t('prof.privacy')} />
        <View style={styles.privacy}>
          <Icon name="shield-lock-outline" size={20} color={colors.textMuted} />
          <T variant="label" style={{ flex: 1 }}>
            {t('prof.privacyText')}
          </T>
        </View>
        {SHOW_ACCOUNT_RESET ? (
          <>
            <SectionHeader title={t('prof.dev')} subtitle={t('prof.devSub')} />
            <Button
              title={t('prof.resetBtn')}
              icon="logout-variant"
              variant="secondary"
              onPress={confirmReset}
              accessibilityLabel={t('prof.resetA11y')}
            />
          </>
        ) : null}

        <T variant="caption" style={{ marginTop: space.lg, textAlign: 'center', color: colors.textSubtle }}>
          {t('prof.credits')}
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
