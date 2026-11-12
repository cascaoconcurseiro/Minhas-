// Tarefas que não podem ser interrompidas por uma atualização automática do sistema
// (ex.: salvando na nuvem). A tela registra e remove; a atualização consulta.
const blockers = new Set<string>();

export function setUpdateBlocker(key: string, active: boolean): void {
  if (active) blockers.add(key);
  else blockers.delete(key);
}

export function hasUpdateBlockers(): boolean {
  return blockers.size > 0;
}
