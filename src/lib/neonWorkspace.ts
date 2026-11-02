import { auth } from './firebase';

export interface NeonWorkspaceSnapshot {
  payload: Record<string, unknown>;
  revision: number;
  updatedAt: string;
}

export class NeonWorkspaceError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'NeonWorkspaceError';
  }
}

async function authorizedRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new NeonWorkspaceError('Entre com uma conta Firebase para sincronizar.', 401);
  }

  const send = async (forceRefresh: boolean) => {
    const token = await user.getIdToken(forceRefresh);
    return fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  };

  let response = await send(false);
  if (response.status === 401) response = await send(true);
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    throw new NeonWorkspaceError(
      body.error || 'Falha ao sincronizar os dados com Neon.',
      response.status
    );
  }
  return body as T;
}

export function loadNeonWorkspace(): Promise<NeonWorkspaceSnapshot> {
  return authorizedRequest<NeonWorkspaceSnapshot>('/api/workspace');
}

export function importFirestoreWorkspace(
  payload: Record<string, unknown>,
  sourceUpdatedAt: string | null
): Promise<{
  ok: true;
  vaultId: string;
  payloadSha256: string;
  entityCounts: Record<string, number | null>;
}> {
  return authorizedRequest('/api/workspace/migrate', {
    method: 'POST',
    body: JSON.stringify({ payload, sourceUpdatedAt }),
  });
}

export function saveNeonWorkspace(
  payload: Record<string, unknown>,
  expectedRevision: number
): Promise<{ revision: number; updatedAt: string }> {
  return authorizedRequest('/api/workspace', {
    method: 'PUT',
    body: JSON.stringify({ payload, expectedRevision }),
  });
}
