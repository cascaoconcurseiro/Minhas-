import type { Category, Transaction } from '../types/finance';
import { CATEGORY_CATALOG_VERSION, INITIAL_CATEGORIES } from './seedData';

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Remove a subcategoria (que não existe mais) de categorias salvas por versões antigas. */
export function stripLegacySubcategories(categories: Category[]): Category[] {
  return categories.map((category) => {
    if (!('subcategories' in (category as unknown as Record<string, unknown>))) return category;
    const { subcategories: _removed, ...rest } = category as Category & { subcategories?: unknown };
    void _removed;
    return rest as Category;
  });
}

/** Remove a subcategoria de lançamentos salvos por versões antigas (a categoria principal permanece). */
export function stripLegacyTransactionSubcategory(transactions: Transaction[]): Transaction[] {
  return transactions.map((transaction) => {
    if (!('subcategoryId' in (transaction as unknown as Record<string, unknown>))) return transaction;
    const { subcategoryId: _removed, ...rest } = transaction as Transaction & { subcategoryId?: unknown };
    void _removed;
    return rest as Transaction;
  });
}

export interface CategoryCatalogMergeResult {
  categories: Category[];
  version: number;
  /** Nomes das categorias acrescentadas nesta atualização. */
  added: string[];
}

/**
 * Atualiza o workspace para o catálogo atual de categorias, uma única vez (controlado por versão):
 * acrescenta as categorias novas que ainda não existem (por id ou por nome), sem alterar, renomear ou
 * recriar as que a pessoa já tem ou apagou depois. Também limpa resquícios de subcategorias.
 */
export function mergeCategoryCatalog(
  existing: Category[],
  appliedVersion: number | undefined,
  catalog: Category[] = INITIAL_CATEGORIES
): CategoryCatalogMergeResult {
  const cleaned = stripLegacySubcategories(existing);
  if ((appliedVersion ?? 0) >= CATEGORY_CATALOG_VERSION) {
    return { categories: cleaned, version: appliedVersion ?? CATEGORY_CATALOG_VERSION, added: [] };
  }

  const ids = new Set(cleaned.map((category) => category.id));
  const names = new Set(cleaned.map((category) => `${category.type}:${normalizeName(category.name)}`));
  const added: Category[] = [];
  for (const category of catalog) {
    if (ids.has(category.id)) continue;
    if (names.has(`${category.type}:${normalizeName(category.name)}`)) continue;
    added.push(category);
  }
  return {
    categories: [...cleaned, ...added],
    version: CATEGORY_CATALOG_VERSION,
    added: added.map((category) => category.name),
  };
}
