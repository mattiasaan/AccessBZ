// Componenti grafici riutilizzabili, con animazioni leggere e etichette per lo screen reader.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { STATUSES } from '../constants';
import { LANGUAGES, t } from '../i18n';
import { colors, fonts, radius, shadow, space, type } from '../theme';

export function Icon({ name, size = 22, color = colors.text, style }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
}

export function T({ variant = 'body', style, children, ...props }) {
  return (
    <Text style={[type[variant], style]} {...props}>
      {children}
    </Text>
  );
}

// Proprietà che decidono la posizione nel layout: vanno sul contenitore esterno,
// altrimenti ad esempio "flex: 1" non ha effetto e i pulsanti affiancati non si dividono lo spazio.
const OUTER_KEYS = new Set([
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'position', 'top', 'bottom', 'left', 'right', 'zIndex',
]);

// Pressable che si "abbassa" leggermente al tocco (senza cambiare dimensione nel layout)
export function PressableScale({ children, style, onPress, disabled, scaleTo = 0.97, ...props }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  const outer = {};
  const inner = {};
  Object.entries(StyleSheet.flatten(style) || {}).forEach(([k, v]) => {
    (OUTER_KEYS.has(k) ? outer : inner)[k] = v;
  });
  if (outer.flex != null || outer.flexGrow != null) inner.flexGrow = 1; // il contenuto riempie lo spazio

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => animate(scaleTo)}
      onPressOut={() => animate(1)}
      style={outer}
      {...props}
    >
      <Animated.View style={[inner, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

// Entrata morbida: dissolvenza + leggero scorrimento verso l'alto
export function FadeIn({ children, delay = 0, style, from = 10 }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1, duration: 320, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const BUTTON_VARIANTS = {
  primary: { bg: colors.primary, text: '#fff', border: colors.primary },
  secondary: { bg: colors.surface, text: colors.text, border: colors.border },
  soft: { bg: colors.primarySoft, text: colors.primaryDark, border: colors.primarySoft },
  success: { bg: colors.success, text: '#fff', border: colors.success },
  danger: { bg: colors.danger, text: '#fff', border: colors.danger },
  ghost: { bg: 'transparent', text: colors.primary, border: 'transparent' },
};

export function Button({ title, icon, onPress, variant = 'primary', size = 'lg', disabled, loading, style, accessibilityLabel }) {
  const v = BUTTON_VARIANTS[variant];
  const off = disabled || loading;
  return (
    <PressableScale
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !!off }}
      style={[
        styles.button,
        size === 'sm' && styles.buttonSm,
        { backgroundColor: v.bg, borderColor: v.border },
        off && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 18 : 20} color={v.text} /> : null}
          <Text
            numberOfLines={1}
            style={[styles.buttonText, size === 'sm' && { fontSize: 14 }, { color: v.text, flexShrink: 1 }]}
          >
            {title}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

// Riquadro con icona su sfondo colorato tenue
export function IconBadge({ name, color = colors.primary, bg, size = 40, iconSize }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size * 0.32,
        backgroundColor: bg || color + '1A', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Icon name={name} size={iconSize || size * 0.52} color={color} />
    </View>
  );
}

// Opzione selezionabile. Bordo e dimensioni sono SEMPRE uguali: cambia solo il colore,
// così la card non "cresce" quando viene selezionata.
export function OptionCard({ icon, label, hint, selected, onPress, style }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={[styles.option, selected && styles.optionSelected, style]}
    >
      <IconBadge
        name={icon}
        color={selected ? '#fff' : colors.primary}
        bg={selected ? colors.primary : colors.primarySoft}
        size={44}
      />
      <View style={{ flex: 1 }}>
        <T variant="heading" numberOfLines={1}>{label}</T>
        {hint ? <T variant="label" numberOfLines={1} style={{ marginTop: 2 }}>{hint}</T> : null}
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </PressableScale>
  );
}

export function Chip({ label, icon, selected, onPress, color = colors.primary }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.chip, selected && { backgroundColor: colors.text, borderColor: colors.text }]}
    >
      {icon ? <Icon name={icon} size={16} color={selected ? '#fff' : color} /> : null}
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </PressableScale>
  );
}

export function StatusPill({ status }) {
  const s = STATUSES[status] || { label: status, color: '#999', soft: '#eee' };
  return (
    <View style={[styles.pill, { backgroundColor: s.soft }]} accessibilityLabel={t('status.a11y', { s: s.label })}>
      <View style={[styles.pillDot, { backgroundColor: s.color }]} />
      <Text style={[styles.pillText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title, subtitle, style }) {
  return (
    <View style={[{ marginTop: space.xl, marginBottom: space.md }, style]}>
      <T variant="overline" accessibilityRole="header">{title}</T>
      {subtitle ? <T variant="label" style={{ marginTop: 4 }}>{subtitle}</T> : null}
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]} />;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.xl,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonSm: { minHeight: 42, paddingHorizontal: space.lg, borderRadius: radius.sm },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.1 },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md,
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, marginBottom: space.sm,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: '#F7F9FF' },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface,
    borderRadius: radius.pill, paddingHorizontal: 12, height: 36, borderWidth: 1,
    borderColor: colors.border, ...shadow.sm,
  },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },

  pill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontFamily: fonts.semibold, fontSize: 12 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg,
    marginBottom: space.md, ...shadow.sm,
  },
});

// Scelta della lingua: Italiano / Deutsch
export function LanguageSwitch({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={t('common.language')}>
      {Object.entries(LANGUAGES).map(([code, name]) => (
        <Chip key={code} label={name} selected={value === code} onPress={() => onChange(code)} />
      ))}
    </View>
  );
}
