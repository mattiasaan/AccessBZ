// Design system di AccessBZ: colori, tipografia, spaziature, ombre.
import { Platform } from 'react-native';

export const colors = {
  bg: '#F5F6F8',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F2F5',
  border: '#E3E6EB',
  borderStrong: '#CBD2DB',

  text: '#0F172A',
  textMuted: '#5B6678',
  textSubtle: '#8D97A7',

  primary: '#2457E6',
  primaryDark: '#1A3FAE',
  primarySoft: '#ECF1FE',

  success: '#15803D',
  successSoft: '#ECFDF3',
  warning: '#C2410C',
  warningSoft: '#FFF5ED',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',

  alert: '#FFB020',
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const type = {
  display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: colors.text },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4, color: colors.text },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.text },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  overline: {
    fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8,
    textTransform: 'uppercase', color: colors.textSubtle,
  },
};

// Colore tenue OPACO (mescolato con il bianco). Da usare al posto di colori semitrasparenti
// sugli elementi con ombra: su Android l'ombra (elevation) si vede attraverso gli sfondi
// trasparenti e crea zone scure.
export function softTint(hex, amount = 0.08) {
  const n = parseInt(hex.slice(1, 7), 16);
  const mix = (c) => Math.round(255 - (255 - c) * amount);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export const radius ={ sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

export const shadow = {
  sm: Platform.select({
    ios: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    default: { elevation: 2 },
  }),
  md: Platform.select({
    ios: { shadowColor: '#0F172A', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
    default: { elevation: 6 },
  }),
  lg: Platform.select({
    ios: { shadowColor: '#0F172A', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
    default: { elevation: 12 },
  }),
};
