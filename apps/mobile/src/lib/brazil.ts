/** Brazilian states: full name → UF. */
const STATES: Record<string, string> = {
  acre: 'AC',
  alagoas: 'AL',
  amapa: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceara: 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  goias: 'GO',
  maranhao: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  para: 'PA',
  paraiba: 'PB',
  parana: 'PR',
  pernambuco: 'PE',
  piaui: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondonia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
};
const UFS = new Set(Object.values(STATES));

/**
 * Reverse-geocoding returns the region as "MG" (iOS) or "Minas Gerais"
 * (Android / some locales). Normalise both to the 2-letter UF.
 */
export function toUF(region?: string | null): string | null {
  if (!region) return null;
  const r = region.trim();
  if (r.length === 2 && UFS.has(r.toUpperCase())) return r.toUpperCase();
  const key = r
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^(estado d[eoa]s? )/, '');
  return STATES[key] ?? null;
}
