/**
 * Ordem das listas de lançamentos. Regra do dono: toda lista de lançamentos é cronológica
 * (do dia 1 para o fim do mês). Dentro do mesmo dia vale a ordem original dos lançamentos
 * (a ordenação do JavaScript é estável). Devolve uma cópia; não mexe na lista recebida.
 */
export function sortChronologically<T extends { date: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date));
}
