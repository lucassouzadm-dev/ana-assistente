export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function parseBRL(value: string): number {
  return parseFloat(value.replace(/[R$\s.]/g, '').replace(',', '.'))
}
