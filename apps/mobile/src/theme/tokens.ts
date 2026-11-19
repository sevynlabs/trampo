/**
 * TRAMPO 2.0 — design tokens.
 * Paleta oficial: #041E42 (principal), #FF6A00 (ação/conversão),
 * #0096D6 (secundária/destaque), #F5F8FC (fundo leve).
 */
export const colors = {
  navy: '#041E42',
  navySoft: '#0B2E5C',
  orange: '#FF6A00',
  orangePress: '#E85F00',
  orangeSoft: '#FFE7D6',
  orangeTint: '#FFF4EB',
  sky: '#0096D6',
  skySoft: '#E1F3FB',

  background: '#F5F8FC',
  surface: '#FFFFFF',
  hairline: '#E6EBF2',
  input: '#D5DDE8',

  ink: '#041E42',
  inkSoft: '#35435A',
  inkMuted: '#5F6B7E',
  inkFaint: '#9AA5B8',

  success: '#16A34A',
  successSoft: '#E7F6EC',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  danger: '#E11D48',
  dangerSoft: '#FDE8ED',
  star: '#FF9F0A',
  white: '#FFFFFF',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  card: 18,
  pill: 9999,
} as const;

export const shadow = {
  card: {
    shadowColor: '#041E42',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cta: {
    shadowColor: '#FF6A00',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

export const font = {
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.6, color: colors.ink },
  h2: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4, color: colors.ink },
  h3: { fontSize: 18, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.inkSoft },
  caption: { fontSize: 13, color: colors.inkMuted },
};
