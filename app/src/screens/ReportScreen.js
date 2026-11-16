// Nuova segnalazione: categoria -> foto -> posizione -> durata -> pubblica.
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../api';
import { useApp } from '../AppContext';
import { Button, FadeIn, Icon, PressableScale, SectionHeader, T } from '../components/ui';
import { CATEGORIES, DURATIONS } from '../constants';
import { colors, fonts, radius, shadow, softTint, space } from '../theme';
import { inRegion, timeAgo } from '../utils';

// Durata suggerita in base alla categoria (l'utente può cambiarla)
const DEFAULT_DURATION = {
  vehicle: 'minutes', bikes: 'hours', tables: 'hours', obstacle: 'hours', snow: 'hours',
  works: 'days', closed: 'days', construction: 'weeks', elevator: 'unknown', other: 'unknown',
};

export default function ReportScreen({ navigation, route }) {
  const { position, deviceId, refreshReports, openReport, setFocusPoint } = useApp();
  const pick = route.params?.pick;

  const [category, setCategory] = useState(null);
  const [duration, setDuration] = useState('unknown');
  const [photo, setPhoto] = useState(null); // { uri, base64 }
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const location = pick || position;
  // Fuori dal Trentino-Alto Adige il server rifiuta la segnalazione: lo diciamo subito
  const outside = !!location && !inRegion(location);

  useEffect(() => {
    if (category) setDuration(DEFAULT_DURATION[category]);
  }, [category]);

  const takePhoto = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permesso negato', 'Consenti l’accesso per allegare una foto.');
      return;
    }
    try {
      const opts = { mediaTypes: ['images'], quality: 0.8 };
      const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled) return;

      // Riduciamo la foto (max 900 px, JPEG compresso) per caricarla velocemente
      const rendered = await ImageManipulator.ImageManipulator.manipulate(res.assets[0].uri)
        .resize({ width: 900 })
        .renderAsync();
      const saved = await rendered.saveAsync({
        format: ImageManipulator.SaveFormat.JPEG,
        compress: 0.6,
        base64: true,
      });
      setPhoto({ uri: saved.uri, base64: saved.base64 });
    } catch {
      Alert.alert('Foto non disponibile', 'Non è stato possibile usare questa foto. Riprova con un’altra.');
    }
  };

  const reset = () => {
    setCategory(null);
    setPhoto(null);
    setDescription('');
    navigation.setParams({ pick: undefined });
  };

  // Anti-duplicati: se lì vicino c'è già lo stesso ostacolo, meglio confermarlo che crearne un altro
  const askAboutDuplicate = (dup) =>
    new Promise((resolve) => {
      const cat = CATEGORIES[dup.category];
      Alert.alert(
        'Forse è già stato segnalato',
        `${cat.label} a ${dup.distance_m} m da qui, segnalato ${timeAgo(dup.created_at)}` +
          (dup.confirmations ? ` e confermato da ${dup.confirmations} ${dup.confirmations === 1 ? 'persona' : 'persone'}` : '') +
          '.\n\nÈ lo stesso ostacolo? Confermarlo aiuta la community più di una nuova segnalazione.',
        [
          { text: 'È lo stesso: confermalo', onPress: () => resolve('confirm') },
          { text: 'È un altro: pubblica', onPress: () => resolve('publish') },
          { text: 'Annulla', style: 'cancel', onPress: () => resolve('cancel') },
        ],
        { cancelable: true, onDismiss: () => resolve('cancel') },
      );
    });

  const publish = async () => {
    setSaving(true);
    try {
      const dups = await api.nearby(location.lat, location.lon, category, deviceId).catch(() => []);
      const dup = dups[0]; // il più vicino
      if (dup) {
        const choice = await askAboutDuplicate(dup);
        if (choice === 'cancel') return;
        if (choice === 'confirm') {
          await api.vote(dup.id, deviceId, true);
          await refreshReports();
          reset();
          navigation.navigate('Mappa');
          setFocusPoint({ lat: dup.lat, lon: dup.lon, zoom: 18, t: Date.now() });
          openReport(dup.id);
          return;
        }
      }
      const created = await api.createReport(
        {
          category,
          lat: location.lat,
          lon: location.lon,
          description,
          duration_class: duration,
          photo_base64: photo?.base64 || null,
        },
        deviceId,
      );
      await refreshReports();
      reset();
      navigation.navigate('Mappa');
      setFocusPoint({ lat: created.lat, lon: created.lon, zoom: 18, t: Date.now() });
      openReport(created.id);
    } catch (e) {
      Alert.alert('Pubblicazione non riuscita', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FadeIn>
            <T variant="title" accessibilityRole="header">Segnala un ostacolo</T>
            <T variant="body" style={{ color: colors.textMuted, marginTop: 4 }}>
              Bastano pochi secondi. La community lo terrà aggiornato.
            </T>
          </FadeIn>

          <SectionHeader title="1 · Che cosa blocca il passaggio?" />
          <View style={styles.grid}>
            {Object.entries(CATEGORIES).map(([key, c], i) => {
              const sel = category === key;
              return (
                <FadeIn key={key} delay={i * 25} style={styles.catWrap}>
                  <PressableScale
                    onPress={() => setCategory(key)}
                    style={[styles.cat, sel && { borderColor: c.tint, backgroundColor: softTint(c.tint, 0.08) }]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sel }}
                    accessibilityLabel={c.label}
                  >
                    <View style={[styles.catIcon, { backgroundColor: sel ? c.tint : c.tint + '1A' }]}>
                      <Icon name={c.icon} size={22} color={sel ? '#fff' : c.tint} />
                    </View>
                    <T variant="label" numberOfLines={2} style={[styles.catLabel, sel && { color: colors.text }]}>
                      {c.short}
                    </T>
                  </PressableScale>
                </FadeIn>
              );
            })}
          </View>

          <SectionHeader title="2 · Foto" subtitle="Facoltativa. Evita di inquadrare volti e targhe." />
          {photo ? (
            <FadeIn>
              <View>
                <Image source={{ uri: photo.uri }} style={styles.photo} accessibilityLabel="Foto allegata" />
                <PressableScale style={styles.photoRemove} onPress={() => setPhoto(null)} accessibilityLabel="Rimuovi foto">
                  <Icon name="close" size={18} color="#fff" />
                </PressableScale>
              </View>
            </FadeIn>
          ) : (
            <View style={styles.row}>
              <Button title="Scatta" icon="camera-outline" variant="secondary" style={{ flex: 1 }} onPress={() => takePhoto(true)} />
              <Button title="Galleria" icon="image-outline" variant="secondary" style={{ flex: 1 }} onPress={() => takePhoto(false)} />
            </View>
          )}

          <SectionHeader title="3 · Posizione" />
          <View style={styles.locBox}>
            <View style={styles.locIcon}>
              <Icon name={pick ? 'map-marker-outline' : 'crosshairs-gps'} size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="bodyMedium" style={outside ? { color: colors.danger } : null}>
                {outside
                  ? 'Sei fuori dal Trentino-Alto Adige'
                  : pick ? 'Punto scelto sulla mappa' : position ? 'La tua posizione attuale' : 'In attesa del GPS…'}
              </T>
              <T variant="caption">
                {outside
                  ? 'Tieni premuto sulla mappa per scegliere un punto nella regione.'
                  : pick
                    ? 'Tocca la × per tornare alla tua posizione.'
                    : 'Tieni premuto sulla mappa per segnalare in un altro punto.'}
              </T>
            </View>
            {pick ? (
              <PressableScale
                onPress={() => navigation.setParams({ pick: undefined })}
                style={styles.locClear}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Rimuovi il punto scelto e usa la mia posizione"
              >
                <Icon name="close" size={18} color={colors.textMuted} />
              </PressableScale>
            ) : null}
          </View>

          <SectionHeader title="4 · Quanto durerà?" />
          <View style={styles.durations}>
            {Object.entries(DURATIONS).map(([key, d]) => {
              const sel = duration === key;
              return (
                <PressableScale
                  key={key}
                  onPress={() => setDuration(key)}
                  style={[styles.dur, sel && styles.durSel]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={d.label}
                >
                  <Icon name={d.icon} size={17} color={sel ? '#fff' : colors.textMuted} />
                  <T variant="label" style={{ color: sel ? '#fff' : colors.text }}>{d.label}</T>
                </PressableScale>
              );
            })}
          </View>

          <SectionHeader title="5 · Descrizione" subtitle="Facoltativa" />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Es. auto parcheggiata davanti alla rampa"
            placeholderTextColor={colors.textSubtle}
            maxLength={300}
            multiline
            style={styles.input}
            accessibilityLabel="Descrizione"
          />

          <Button
            title="Pubblica segnalazione"
            icon="send-outline"
            onPress={publish}
            disabled={!category || !location || outside}
            loading={saving}
            style={{ marginTop: space.xl }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, paddingBottom: 48 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  catWrap: { width: '33.333%', padding: 4 },
  cat: {
    height: 96, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5,
    borderColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 8, ...shadow.sm,
  },
  catIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catLabel: { textAlign: 'center', fontSize: 12, lineHeight: 15 },
  row: { flexDirection: 'row', gap: space.sm },
  photo: { width: '100%', height: 210, borderRadius: radius.lg },
  photoRemove: {
    position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  locBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: space.md, ...shadow.sm,
  },
  locIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  locClear: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  durations: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  dur: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 40,
  },
  durSel: { backgroundColor: colors.text, borderColor: colors.text },
  input: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    padding: space.md, fontSize: 15, fontFamily: fonts.regular, color: colors.text, minHeight: 90,
    textAlignVertical: 'top',
  },
});
