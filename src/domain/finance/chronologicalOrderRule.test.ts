import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

// Regra do dono: toda lista de lançamentos é cronológica (do mais antigo ao mais novo), em qualquer tela.
// Este teste barra quem ordenar por data decrescente ou inverter uma lista. Os arquivos abaixo escolhem
// "o mais recente" de um conjunto (não exibem lista) e por isso são a exceção conhecida.
const NOT_A_LIST = new Set([
  'domain/budgets/learningRules.ts',
  'domain/budgets/decisionEngine.ts',
  'domain/budgets/transactionSuggestions.ts',
  'domain/trips/exchangeSavings.ts',
]);

const walk = (dir: URL, prefix = ''): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory()
    ? walk(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`)
    : /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [`${prefix}${entry.name}`] : []);

test('nenhuma lista é ordenada por data decrescente (ordem cronológica é o padrão)', () => {
  const root = new URL('../../', import.meta.url);
  const offenders: string[] = [];
  for (const file of walk(root)) {
    if (NOT_A_LIST.has(file)) continue;
    const text = readFileSync(new URL(file, root), 'utf8');
    if (/\b(\w+)\.(?:transaction\.)?date\.localeCompare\(\s*\w+\.(?:transaction\.)?date\s*\)/.test(text)) {
      // a.date.localeCompare(b.date) é crescente; só é decrescente quando o lado esquerdo é "b"
      if (/\bb\.(?:transaction\.)?date\.localeCompare\(\s*a\./.test(text)) offenders.push(file);
    }
    if (/entriesNewestFirst|newestFirst/i.test(text)) offenders.push(`${file} (lista invertida)`);
  }
  assert.deepEqual(offenders, [], `Listas fora da ordem cronológica: ${offenders.join(', ')}`);
});
