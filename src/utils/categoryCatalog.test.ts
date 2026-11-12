import assert from 'node:assert/strict';
import test from 'node:test';
import type { Category, Transaction } from '../types/finance';
import {
  mergeCategoryCatalog,
  stripLegacySubcategories,
  stripLegacyTransactionSubcategory,
} from './categoryCatalog';
import { CATEGORY_CATALOG_VERSION, INITIAL_CATEGORIES } from './seedData';

const legacy = (id: string, name: string, type: 'income' | 'expense' = 'expense'): Category =>
  ({
    id, name, type, bucket: 'essential', monthlyBudget: 100, color: '#000', icon: 'tag',
    subcategories: [{ id: 'sub-old', name: 'Antiga' }],
  }) as unknown as Category;

test('the default catalog has unique ids and names, valid types and no subcategories', () => {
  const ids = INITIAL_CATEGORIES.map((category) => category.id);
  assert.equal(new Set(ids).size, ids.length, 'ids únicos');
  const names = INITIAL_CATEGORIES.map((category) => `${category.type}:${category.name}`);
  assert.equal(new Set(names).size, names.length, 'nomes únicos por tipo');
  assert.ok(INITIAL_CATEGORIES.length >= 40, 'lista completa para o dia a dia no Brasil');
  for (const category of INITIAL_CATEGORIES) {
    assert.ok(['income', 'expense'].includes(category.type));
    assert.ok(['essential', 'lifestyle', 'financial'].includes(category.bucket));
    assert.equal('subcategories' in category, false, `${category.id} não tem subcategorias`);
  }
  // Categorias que o sistema usa internamente precisam existir
  for (const id of ['cat-outros', 'cat-aportes', 'cat-fatura', 'cat-rendimentos', 'cat-viagens']) {
    assert.ok(ids.includes(id), id);
  }
});

test('an old workspace gets the new categories once, keeps its own and loses the subcategories', () => {
  const existing = [legacy('cat-mercado', 'Supermercado & Feira'), legacy('cat-minha', 'Minha categoria')];
  const result = mergeCategoryCatalog(existing, undefined);
  assert.equal(result.version, CATEGORY_CATALOG_VERSION);
  assert.ok(result.added.length > 30);
  const byId = new Map(result.categories.map((category) => [category.id, category]));
  assert.equal(byId.get('cat-mercado')?.name, 'Supermercado & Feira', 'não renomeia o que a pessoa já tem');
  assert.equal(byId.get('cat-mercado')?.monthlyBudget, 100, 'mantém o teto de gastos');
  assert.ok(byId.has('cat-minha'));
  assert.ok(byId.has('cat-pets') && byId.has('cat-farmacia') && byId.has('cat-viagens'));
  assert.equal(result.categories.some((category) => 'subcategories' in category), false);
});

test('the catalog is applied only once: a category deleted afterwards is not recreated', () => {
  const first = mergeCategoryCatalog([legacy('cat-minha', 'Minha categoria')], undefined);
  const withoutPets = first.categories.filter((category) => category.id !== 'cat-pets');
  const second = mergeCategoryCatalog(withoutPets, first.version);
  assert.equal(second.added.length, 0);
  assert.equal(second.categories.some((category) => category.id === 'cat-pets'), false);
});

test('does not duplicate a category the person already created with the same name', () => {
  const existing = [legacy('cat-custom-pets', 'Pets')];
  const result = mergeCategoryCatalog(existing, undefined);
  assert.equal(result.categories.filter((category) => category.name === 'Pets').length, 1);
  assert.equal(result.categories.some((category) => category.id === 'cat-pets'), false);
});

test('legacy subcategory fields are stripped from categories and transactions without touching the rest', () => {
  const [category] = stripLegacySubcategories([legacy('cat-a', 'A')]);
  assert.equal('subcategories' in category, false);
  assert.equal(category.name, 'A');

  const transactions = [
    { id: 't1', categoryId: 'cat-a', subcategoryId: 'sub-old', amount: 10 },
    { id: 't2', categoryId: 'cat-a', amount: 5 },
  ] as unknown as Transaction[];
  const cleaned = stripLegacyTransactionSubcategory(transactions);
  assert.equal('subcategoryId' in cleaned[0], false);
  assert.equal(cleaned[0].categoryId, 'cat-a');
  assert.equal(cleaned[0].amount, 10);
  assert.equal(cleaned[1], transactions[1], 'o que já está limpo não é copiado');
});
