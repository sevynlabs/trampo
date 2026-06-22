/**
 * Format an integer amount in centavos as Brazilian Real (e.g. 5000 -> "R$ 50,00").
 */
export function formatCurrency(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}
