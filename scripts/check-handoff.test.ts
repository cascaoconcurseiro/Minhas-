import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { extractLatestEntry, validateChangedFiles, validateHandoffStructure } from './check-handoff';

const base = `# Handoff
## 1. Estado atual
## 2. Em andamento
## 3. Próximos passos
## 4. Pendências do dono
## 5. Nunca verificado
## 6. Decisões vigentes
## 7. Registro de entregas

### 2026-11-15 — Teste
- **O que mudou:** a
- **Por quê:** b
- **Arquivos/áreas:** c
- **Como foi verificado:** d
- **Não verificado:** e
- **Impacto em dados/Neon:** f
- **Documentação atualizada:** g
- **Próximo passo:** h

### 2026-11-14 — Antiga
- **O que mudou:** x
`;

test('HANDOFF completo é aceito e a entrada mais recente é a primeira', () => {
  assert.deepEqual(validateHandoffStructure(base), []);
  assert.match(extractLatestEntry(base) ?? '', /Teste/);
  assert.doesNotMatch(extractLatestEntry(base) ?? '', /Antiga/);
});

test('campo vazio ou ausente na entrada mais recente é erro', () => {
  const empty = base.replace('- **Por quê:** b', '- **Por quê:**');
  assert.ok(validateHandoffStructure(empty).some((p) => p.message.includes('Por quê')));
  const missing = base.replace('- **Próximo passo:** h\n', '');
  assert.ok(validateHandoffStructure(missing).some((p) => p.message.includes('Próximo passo')));
});

test('seção obrigatória ausente é erro', () => {
  assert.ok(validateHandoffStructure(base.replace('## 5. Nunca verificado', '')).some((p) => p.level === 'erro'));
});

test('código alterado sem HANDOFF é erro; com HANDOFF passa; docs sozinhos passam', () => {
  assert.ok(validateChangedFiles(['src/App.tsx']).some((p) => p.level === 'erro'));
  assert.deepEqual(validateChangedFiles(['src/App.tsx', 'HANDOFF.md']).filter((p) => p.level === 'erro'), []);
  assert.deepEqual(validateChangedFiles(['docs/README.md']), []);
});

test('mudança em regra de domínio sem atualizar o documento só avisa', () => {
  const result = validateChangedFiles(['src/domain/finance/financeRules.ts', 'HANDOFF.md']);
  assert.deepEqual(result.map((p) => p.level), ['aviso']);
});

test('o HANDOFF.md real do projeto está no formato exigido', () => {
  assert.deepEqual(validateHandoffStructure(readFileSync('HANDOFF.md', 'utf8')), []);
});
