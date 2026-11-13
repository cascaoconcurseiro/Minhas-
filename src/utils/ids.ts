/**
 * Id novo de entidade: prefixo + hora + sufixo aleatório. Só a hora repetia o id quando dois cadastros caíam no mesmo
 * milissegundo, e a API recusa salvar o workspace com ids repetidos.
 */
export function newEntityId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
