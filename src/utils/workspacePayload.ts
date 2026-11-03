function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/** Parse persisted workspace collections without replacing damaged data with defaults. */
export function parseWorkspaceArray<T>(raw: unknown, fallback: T[], field: string): T[] {
  if (raw === undefined || raw === null) return fallback;

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`O campo ${field} do workspace contém JSON inválido.`);
    }
  }

  if (
    !Array.isArray(parsed) ||
    !parsed.every((item) => isRecord(item) && typeof item.id === 'string' && item.id.trim())
  ) {
    throw new Error(`O campo ${field} do workspace contém uma coleção inválida.`);
  }
  return parsed as T[];
}

/** Parse persisted workspace objects without silently resetting them to defaults. */
export function parseWorkspaceObject<T extends object>(
  raw: unknown,
  fallback: T,
  field: string
): T {
  if (raw === undefined || raw === null) return fallback;

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`O campo ${field} do workspace contém JSON inválido.`);
    }
  }

  if (!isRecord(parsed)) {
    throw new Error(`O campo ${field} do workspace contém um objeto inválido.`);
  }
  return { ...fallback, ...parsed };
}
