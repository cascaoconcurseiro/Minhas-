/**
 * Identificação (só por id, sem importar mais nada) da fatura de cartão adicional cobrada de outra pessoa e do
 * recebimento dela. Fica separado para a classificação do resultado pessoal poder usar sem ciclo de imports.
 */
export const SHARED_CARD_INVOICE_PREFIX = 'tx-cardinv-';
export const SHARED_CARD_INVOICE_SETTLEMENT_SUFFIX = '-cardinv';

export const isSharedCardInvoiceId = (id: string): boolean => id.startsWith(SHARED_CARD_INVOICE_PREFIX);

/** Movimento bancário que recebeu faturas de cartão adicional (não é receita sua). */
export const isSharedCardInvoiceSettlementId = (id: string): boolean =>
  id.startsWith('tx-reimb-') && id.endsWith(SHARED_CARD_INVOICE_SETTLEMENT_SUFFIX);
