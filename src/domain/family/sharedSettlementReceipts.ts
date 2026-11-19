import { isValidISODate } from '../finance/formatting.ts';
export interface SharedSettlementReceipt {
  id: string;
  status: 'pending' | 'received';
  settlementId?: string;
  accountId?: string;
  date?: string;
}

export function parseSharedSettlementReceipts(raw: unknown): SharedSettlementReceipt[] {
  if (raw === undefined) return [];
  const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed)) throw new Error('Recibos de acerto inválidos.');
  const ids = new Set<string>();
  for (const row of parsed) {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id.startsWith('tx-mirror-') || ids.has(row.id) ||
      !['pending', 'received'].includes(row.status) ||
      ['settlementId', 'accountId', 'date'].some((key) => row[key] !== undefined && typeof row[key] !== 'string')) {
      throw new Error('Recibo de acerto inválido.');
    }
    if (row.date) {
      if (!isValidISODate(row.date)) {
        throw new Error('Data do acerto inválida.');
      }
    }
    ids.add(row.id);
  }
  return parsed as SharedSettlementReceipt[];
}
