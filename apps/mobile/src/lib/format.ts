/**
 * Format an integer amount in centavos as Brazilian Real
 * (e.g. 5000 -> "R$ 50,00", 150000 -> "R$ 1.500,00").
 */
export function formatCurrency(centavos: number): string {
  const sign = centavos < 0 ? '-' : '';
  const [int, dec] = (Math.abs(centavos) / 100).toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}R$ ${grouped},${dec}`;
}

/**
 * Centavos -> value for a money text input, without symbol or grouping
 * (e.g. 123456 -> "1234,56").
 */
export function centsToInput(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

/**
 * Parse a pt-BR money string typed by the user into centavos.
 * Accepts "1.234,56", "1234,56", "1234.56" and "1234". Returns NaN if invalid.
 */
export function parseMoneyToCents(text: string): number {
  const clean = text.replace(/[^\d.,]/g, '');
  if (!clean) return NaN;

  const lastComma = clean.lastIndexOf(',');
  const lastDot = clean.lastIndexOf('.');
  // The right-most separator followed by 1-2 digits is the decimal one
  const decimalIdx = Math.max(lastComma, lastDot);
  const hasDecimals = decimalIdx >= 0 && clean.length - decimalIdx - 1 <= 2;

  const intPart = (hasDecimals ? clean.slice(0, decimalIdx) : clean).replace(/[.,]/g, '');
  const decPart = hasDecimals ? clean.slice(decimalIdx + 1).padEnd(2, '0') : '00';

  const cents = Number(intPart || '0') * 100 + Number(decPart);
  return Number.isFinite(cents) ? cents : NaN;
}
