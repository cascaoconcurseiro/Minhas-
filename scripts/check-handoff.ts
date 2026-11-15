/**
 * Verificação obrigatória do HANDOFF.
 *
 * Falha (código 1) quando:
 *  1. o HANDOFF.md perdeu uma das seções obrigatórias ou o modelo de entrada;
 *  2. a entrada mais recente do registro não tem todos os campos do modelo preenchidos;
 *  3. o código mudou (src/, backend/, api/, db/, shared/, package.json) e o HANDOFF.md não mudou junto.
 *
 * Só avisa (não falha) quando regras de negócio (src/domain) mudaram sem alterar
 * docs/produto/regras-de-negocio.md.
 *
 * Uso:
 *   bun run check:handoff                      # compara a árvore de trabalho com o commit anterior (HEAD~1)
 *   bun run check:handoff -- --base <commit>   # compara com outro ponto (usado pelo CI)
 *   bun run check:handoff -- --structure-only  # só valida o formato do HANDOFF.md
 *   bun run check:handoff -- --uncommitted     # só olha o que ainda não foi commitado (usado pelo gancho do Claude Code)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const REQUIRED_SECTIONS = [
  '## 1. Estado atual',
  '## 2. Em andamento',
  '## 3. Próximos passos',
  '## 4. Pendências do dono',
  '## 5. Nunca verificado',
  '## 6. Decisões vigentes',
  '## 7. Registro de entregas',
];

const REQUIRED_FIELDS = [
  'O que mudou',
  'Por quê',
  'Arquivos/áreas',
  'Como foi verificado',
  'Não verificado',
  'Impacto em dados/Neon',
  'Documentação atualizada',
  'Próximo passo',
];

const CODE_PATHS = ['src/', 'backend/', 'api/', 'db/', 'shared/', 'package.json'];

export interface HandoffProblem {
  level: 'erro' | 'aviso';
  message: string;
}

/** Texto da entrada mais recente (primeiro "### AAAA-MM-DD" da seção 7). */
export function extractLatestEntry(handoff: string): string | null {
  const start = handoff.indexOf('## 7. Registro de entregas');
  if (start < 0) return null;
  const section = handoff.slice(start);
  const match = section.match(/^### (\d{4}-\d{2}-\d{2}) — .+$/m);
  if (!match || match.index === undefined) return null;
  const rest = section.slice(match.index);
  const next = rest.slice(3).search(/^(### |> |---)/m);
  return next < 0 ? rest : rest.slice(0, next + 3);
}

export function validateHandoffStructure(handoff: string): HandoffProblem[] {
  const problems: HandoffProblem[] = [];
  for (const heading of REQUIRED_SECTIONS) {
    if (!handoff.includes(heading)) {
      problems.push({ level: 'erro', message: `HANDOFF.md sem a seção obrigatória "${heading}".` });
    }
  }
  const entry = extractLatestEntry(handoff);
  if (!entry) {
    problems.push({ level: 'erro', message: 'HANDOFF.md sem entrada no formato "### AAAA-MM-DD — Título" na seção 7.' });
    return problems;
  }
  for (const field of REQUIRED_FIELDS) {
    const line = entry.split('\n').find((l) => l.startsWith(`- **${field}:**`));
    const value = line?.replace(`- **${field}:**`, '').trim() ?? '';
    if (!line) {
      problems.push({ level: 'erro', message: `Entrada mais recente do HANDOFF sem o campo "${field}".` });
    } else if (value.length === 0) {
      problems.push({ level: 'erro', message: `Campo "${field}" da entrada mais recente do HANDOFF está vazio.` });
    }
  }
  return problems;
}

export function validateChangedFiles(changed: string[]): HandoffProblem[] {
  const problems: HandoffProblem[] = [];
  const codeChanged = changed.some((file) => CODE_PATHS.some((prefix) => file === prefix || file.startsWith(prefix)));
  if (codeChanged && !changed.includes('HANDOFF.md')) {
    problems.push({
      level: 'erro',
      message: 'O código mudou, mas o HANDOFF.md não foi atualizado. Adicione uma entrada na seção 7 (modelo no fim do arquivo).',
    });
  }
  const domainChanged = changed.some((file) => file.startsWith('src/domain/') && !file.endsWith('.test.ts'));
  if (domainChanged && !changed.includes('docs/produto/regras-de-negocio.md')) {
    problems.push({
      level: 'aviso',
      message: 'Regras em src/domain mudaram e docs/produto/regras-de-negocio.md não. Se a regra mudou, atualize o documento; senão, explique no campo "Documentação atualizada".',
    });
  }
  return problems;
}

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function changedFiles(base: string, uncommittedOnly = false): string[] {
  const committed = uncommittedOnly ? '' : git(['diff', '--name-only', `${base}`, 'HEAD']);
  const working = git(['diff', '--name-only', 'HEAD']);
  const untracked = git(['ls-files', '--others', '--exclude-standard']);
  return [...new Set([committed, working, untracked].join('\n').split('\n').filter(Boolean))];
}

function main(): void {
  const args = process.argv.slice(2);
  const structureOnly = args.includes('--structure-only');
  const uncommittedOnly = args.includes('--uncommitted');
  const baseIndex = args.indexOf('--base');
  const explicitBase = baseIndex >= 0 ? args[baseIndex + 1] : undefined;

  if (!existsSync('HANDOFF.md')) {
    console.error('ERRO: HANDOFF.md não existe na raiz do projeto.');
    process.exit(1);
  }
  const problems = validateHandoffStructure(readFileSync('HANDOFF.md', 'utf8'));

  if (!structureOnly) {
    let base = explicitBase && !/^0+$/.test(explicitBase) ? explicitBase : 'HEAD~1';
    try {
      git(['rev-parse', '--verify', base]);
    } catch {
      console.warn(`Aviso: ponto de comparação "${base}" não existe (clone raso?). Verificando só o formato do HANDOFF.`);
      base = '';
    }
    if (base) problems.push(...validateChangedFiles(changedFiles(base, uncommittedOnly)));
  }

  for (const problem of problems) {
    console[problem.level === 'erro' ? 'error' : 'warn'](`${problem.level.toUpperCase()}: ${problem.message}`);
  }
  if (problems.some((p) => p.level === 'erro')) process.exit(1);
  console.log('HANDOFF ok.');
}

if (import.meta.main) main();
