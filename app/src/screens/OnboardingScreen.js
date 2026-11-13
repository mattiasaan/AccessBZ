// Prima apertura: nome e profilo di mobilità. Nessuna email, nessuna password.
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../AppContext';
import { Button, FadeIn, Icon, OptionCard, SectionHeader, T } from '../components/ui';
import { PROFILES } from '../constants';
import { colors, fonts, radius, space } from '../theme';

export default function OnboardingScreen() {
  const { register } = useApp();
  const [nickname, setNickname] = useState('');
  const [profile, setProfile] = useState('wheelchair');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const start = async () => {
    setLoading(true);
    try {
      await register(nickname.trim(), profile);
    } catch (e) {
      Alert.alert('Registrazione non riuscita', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FadeIn>
            <View style={styles.logoRow}>
              <View style={styles.logo}>
                <Icon name="wheelchair-accessibility" size={26} color="#fff" />
              </View>
              <T variant="heading" style={{ fontSize: 19 }}>AccessBZ</T>
            </View>
          </FadeIn>

          <FadeIn delay={80}>
            <T variant="display" style={{ marginTop: space.xl }}>
              La città è la stessa.{'\n'}
              <T variant="display" style={{ color: colors.primary }}>Il percorso non lo è.</T>
            </T>
            <T variant="body" style={{ color: colors.textMuted, marginTop: space.md }}>
              Una mappa che mostra cosa succede adesso sui marciapiedi di Bolzano: ostacoli, lavori,
              ascensori guasti. Segnalati e confermati dalla community.
            </T>
          </FadeIn>

          <FadeIn delay={160}>
            <SectionHeader title="Come ti chiami?" />
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Nome o soprannome"
              placeholderTextColor={colors.textSubtle}
              maxLength={40}
              style={[styles.input, focused && styles.inputFocused]}
              accessibilityLabel="Nome o soprannome"
            />

            <SectionHeader title="Come ti muovi in città?" subtitle="Vedrai solo gli ostacoli che contano per te." />
            {Object.entries(PROFILES).map(([key, p]) => (
              <OptionCard
                key={key}
                icon={p.icon}
                label={p.label}
                hint={p.hint}
                selected={profile === key}
                onPress={() => setProfile(key)}
              />
            ))}

            <View style={styles.privacy}>
              <Icon name="shield-lock-outline" size={20} color={colors.textMuted} />
              <T variant="label" style={{ flex: 1 }}>
                Niente email né password. I tuoi spostamenti non vengono salvati: la posizione serve solo a
                mostrarti gli ostacoli vicini e a localizzare le tue segnalazioni.
              </T>
            </View>
            <Button title="Inizia" icon="arrow-right" onPress={start} disabled={!nickname.trim()} loading={loading} />
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, paddingBottom: 48 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: space.sm },
  logo: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.lg, height: 54, fontSize: 16, fontFamily: fonts.medium, color: colors.text,
  },
  inputFocused: { borderColor: colors.primary },
  privacy: {
    flexDirection: 'row', gap: space.md, alignItems: 'flex-start', marginVertical: space.xl,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md,
  },
});
