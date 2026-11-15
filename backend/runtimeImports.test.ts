import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import test from 'node:test';

/**
 * A API roda na Vercel direto em Node (sem empacotar): todo import relativo de código que o backend
 * executa precisa ter extensão explícita (.ts ou .js). Sem isso a função cai com HTTP 500 em produção
 * (já aconteceu duas vezes). Importar só tipos de `src/types/finance` é seguro: o compilador remove o import.
 */
const TYPES_ONLY_TARGET = 'src/types/finance.ts';
const IMPORT = /^(import|export)\s+(type\s+)?[^;]*?from\s+'(\.{1,2}\/[^']+)'/gms;

function resolveImport(from: string, spec: string): string | null {
  const base = normalize(join(dirname(from), spec));
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, base.replace(/\.js$/, '.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

test('todo import relativo executado pelo backend tem extensão explícita', () => {
  const seen = new Set<string>();
  const stack = ['backend/app.ts'];
  const problems: string[] = [];
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(IMPORT)) {
      const isTypeOnly = Boolean(match[2]);
      const spec = match[3];
      if (isTypeOnly) continue;
      const target = resolveImport(file, spec);
      if (target) stack.push(target);
      const hasExtension = /\.(ts|tsx|js|mjs)$/.test(spec);
      if (!hasExtension && target !== TYPES_ONLY_TARGET) problems.push(`${file}: '${spec}'`);
    }
  }
  assert.deepEqual(problems, [], `Imports sem extensão no caminho do backend (quebram a API na Vercel):\n${problems.join('\n')}`);
  assert.ok(seen.has('src/domain/finance/financeRules.ts'), 'o teste precisa alcançar financeRules.ts a partir do backend');
});
