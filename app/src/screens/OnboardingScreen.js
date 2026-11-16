// Prima apertura: nome e profilo di mobilità. Nessuna email, nessuna password.
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../AppContext';
import { Button, FadeIn, Icon, LanguageSwitch, OptionCard, SectionHeader, T } from '../components/ui';
import { DEFAULT_PROFILE, PROFILES } from '../constants';
import { t } from '../i18n';
import { colors, fonts, radius, space } from '../theme';

export default function OnboardingScreen() {
  const { register, language, updateSettings } = useApp();
  const [nickname, setNickname] = useState('');
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const start = async () => {
    setLoading(true);
    try {
      await register(nickname.trim(), profile);
    } catch (e) {
      Alert.alert(t('onb.regFail'), e.message);
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
              <T variant="heading" style={{ fontSize: 19, flex: 1 }}>AccessBZ</T>
              <LanguageSwitch value={language} onChange={(l) => updateSettings({ language: l })} />
            </View>
          </FadeIn>

          <FadeIn delay={80}>
            <T variant="display" style={{ marginTop: space.xl }}>
              {t('onb.tagline1')}{'\n'}
              <T variant="display" style={{ color: colors.primary }}>{t('onb.tagline2')}</T>
            </T>
            <T variant="body" style={{ color: colors.textMuted, marginTop: space.md }}>
              {t('onb.intro')}
            </T>
          </FadeIn>

          <FadeIn delay={160}>
            <SectionHeader title={t('onb.nameQ')} />
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={t('onb.namePh')}
              placeholderTextColor={colors.textSubtle}
              maxLength={40}
              style={[styles.input, focused && styles.inputFocused]}
              accessibilityLabel={t('onb.namePh')}
            />

            <SectionHeader title={t('onb.moveQ')} subtitle={t('onb.moveSub')} />
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
                {t('onb.privacy')}
              </T>
            </View>
            <Button title={t('onb.start')} icon="arrow-right" onPress={start} disabled={!nickname.trim()} loading={loading} />
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
