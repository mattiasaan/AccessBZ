// Scheda di un ostacolo: foto, stato, linea del tempo e la domanda "È ancora presente?".
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, View } from 'react-native';

import { api } from '../api';
import { useApp } from '../AppContext';
import { ACTIVE_STATUSES, CATEGORIES, DURATIONS } from '../constants';
import { t } from '../i18n';
import { colors, radius, space } from '../theme';
import { distanceM, formatDistance, formatMinutes, timeAgo } from '../utils';
import BottomSheet from './BottomSheet';
import PlaceMemory from './PlaceMemory';
import { Button, FadeIn, Icon, IconBadge, StatusPill, T } from './ui';

const TIMELINE = {
  created: { icon: 'map-marker-plus-outline', text: 'sheet.tlCreated', color: colors.primary },
  confirmed: { icon: 'check-circle-outline', text: 'sheet.tlConfirmed', color: '#D97706' },
  gone: { icon: 'close-circle-outline', text: 'sheet.tlGone', color: colors.textMuted },
  resolved: { icon: 'check-decagram-outline', text: 'sheet.tlResolved', color: colors.success },
};

export default function ReportSheet() {
  const { openReportId, openReport, deviceId, refreshReports, position } = useApp();
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (openReportId == null) return;
    setReport(null);
    api.getReport(openReportId, deviceId).then(setReport).catch((e) => {
      Alert.alert(t('common.error'), e.message);
      openReport(null);
    });
  }, [openReportId, deviceId]);

  const close = () => openReport(null);

  const vote = async (present) => {
    setBusy(present ? 'yes' : 'no');
    try {
      await api.vote(report.id, deviceId, present);
      setReport(await api.getReport(report.id, deviceId));
      refreshReports();
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = () =>
    Alert.alert(t('sheet.deleteTitle'), t('sheet.deleteMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sheet.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteReport(report.id, deviceId);
            refreshReports();
            close();
          } catch (e) {
            Alert.alert(t('common.error'), e.message);
          }
        },
      },
    ]);

  const cat = report ? CATEGORIES[report.category] : null;
  const active = report && ACTIVE_STATUSES.includes(report.status);
  const dur = report ? DURATIONS[report.duration_class] : null;

  return (
    <BottomSheet visible={openReportId != null} onClose={close}>
      {!report ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <FadeIn>
            <View style={styles.header}>
              <IconBadge name={cat.icon} color={cat.tint} size={52} />
              <View style={{ flex: 1, gap: 6 }}>
                <T variant="title" style={{ fontSize: 21, lineHeight: 26 }} accessibilityRole="header">
                  {cat.label}
                </T>
                <StatusPill status={report.status} />
              </View>
            </View>
          </FadeIn>

          {report.has_photo ? (
            <FadeIn delay={60}>
              <Image
                source={{ uri: api.photoUrl(report.id) }}
                style={styles.photo}
                accessibilityLabel={t('sheet.photoA11y', { c: cat.label })}
              />
            </FadeIn>
          ) : null}

          {report.description ? (
            <FadeIn delay={80}>
              <T variant="body" style={{ marginBottom: space.lg, color: colors.textMuted }}>
                {report.description}
              </T>
            </FadeIn>
          ) : null}

          <FadeIn delay={100} style={styles.facts}>
            <Fact icon="clock-outline" label={t('sheet.reported')} value={timeAgo(report.created_at)} />
            <Fact
              icon="timer-outline"
              label={t(active ? 'sheet.activeFor' : 'sheet.lasted')}
              value={formatMinutes(report.active_minutes, active)}
            />
            <Fact icon={dur.icon} label={t('sheet.expected')} value={dur.label} />
            <Fact icon="account-group-outline" label={t('sheet.confirmations')} value={String(report.confirmations)} />
            {position ? (
              <Fact icon="map-marker-distance" label={t('sheet.distance')} value={formatDistance(distanceM(position, report))} />
            ) : null}
          </FadeIn>

          <FadeIn delay={140}>
            {active ? (
              <View style={styles.question}>
                <T variant="heading" style={{ textAlign: 'center', marginBottom: space.md }}>
                  {t('sheet.stillThere')}
                </T>
                <View style={styles.row}>
                  <Button
                    title={t('sheet.yes')}
                    icon="check"
                    variant="primary"
                    style={styles.voteBtn}
                    loading={busy === 'yes'}
                    disabled={!!busy}
                    onPress={() => vote(true)}
                    accessibilityLabel={t('sheet.yesA11y')}
                  />
                  <Button
                    title={t('sheet.no')}
                    icon="close"
                    variant="secondary"
                    style={styles.voteBtn}
                    loading={busy === 'no'}
                    disabled={!!busy}
                    onPress={() => vote(false)}
                    accessibilityLabel={t('sheet.noA11y')}
                  />
                </View>
                {report.my_vote != null ? (
                  <T variant="caption" style={{ textAlign: 'center', marginTop: space.sm }}>
                    {t('sheet.youAnswered', { a: t(report.my_vote ? 'sheet.answerPresent' : 'sheet.answerGone') })}
                  </T>
                ) : null}
              </View>
            ) : (
              <View style={[styles.closed, report.status !== 'resolved' && { backgroundColor: colors.surfaceAlt }]}>
                <Icon
                  name={report.status === 'resolved' ? 'check-decagram' : 'archive-outline'}
                  color={report.status === 'resolved' ? colors.success : colors.textMuted}
                  size={24}
                />
                <T variant="bodyMedium" style={{ flex: 1, color: report.status === 'resolved' ? colors.success : colors.textMuted }}>
                  {report.status === 'resolved'
                    ? t('sheet.resolvedMsg', { t: formatMinutes(report.active_minutes) })
                    : t('sheet.expiredMsg')}
                </T>
              </View>
            )}
          </FadeIn>

          <FadeIn delay={170}>
            <T variant="overline" style={{ marginTop: space.xl, marginBottom: space.md }}>{t('sheet.placeMemory')}</T>
            <PlaceMemory place={report.place} />
          </FadeIn>

          <FadeIn delay={200}>
            <T variant="overline" style={{ marginTop: space.xl, marginBottom: space.md }}>{t('sheet.timeline')}</T>
            {report.timeline.map((ev, i) => {
              const m = TIMELINE[ev.type];
              const last = i === report.timeline.length - 1;
              return (
                <View key={i} style={styles.tl}>
                  <View style={styles.tlRail}>
                    <View style={[styles.tlDot, { borderColor: m.color }]}>
                      <Icon name={m.icon} size={14} color={m.color} />
                    </View>
                    {!last ? <View style={styles.tlLine} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: last ? 0 : space.md }}>
                    <T variant="bodyMedium">{t(m.text)}</T>
                    <T variant="caption">
                      {timeAgo(ev.at)}
                      {ev.mine ? ` · ${t('sheet.byYou')}` : ''}
                    </T>
                  </View>
                </View>
              );
            })}
          </FadeIn>

          {report.is_mine ? (
            <Button title={t('sheet.deleteMine')} icon="trash-can-outline" variant="ghost" onPress={remove} style={{ marginTop: space.md }} />
          ) : null}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

function Fact({ icon, label, value }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}: ${value}`}>
      <Icon name={icon} size={18} color={colors.textSubtle} />
      <View style={{ flex: 1 }}>
        <T variant="caption">{label}</T>
        <T variant="bodyMedium" numberOfLines={1}>{value}</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { height: 220, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: space.xl, paddingBottom: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  photo: { width: '100%', height: 210, borderRadius: radius.lg, marginBottom: space.lg, backgroundColor: colors.surfaceAlt },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  fact: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
    borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10, width: '48.8%',
  },
  question: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg },
  row: { flexDirection: 'row', gap: space.sm },
  voteBtn: { flex: 1, paddingHorizontal: space.md },
  closed: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.successSoft,
    borderRadius: radius.lg, padding: space.lg,
  },
  tl: { flexDirection: 'row', gap: space.md },
  tlRail: { alignItems: 'center', width: 28 },
  tlDot: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  tlLine: { flex: 1, width: 1.5, backgroundColor: colors.border, marginVertical: 2 },
});
