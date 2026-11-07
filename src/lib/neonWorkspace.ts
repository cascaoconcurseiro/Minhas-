import { auth } from './firebase';

export interface NeonWorkspaceSnapshot {
  payload: Record<string, unknown>;
  revision: number;
  updatedAt: string;
}

export interface NeonFamilyInvitation {
  invitation_id: string;
  owner_user_id: string;
  owner_email: string;
  invited_email: string;
  invited_user_id?: string | null;
  owner_member_id: string;
  owner_name: string;
  owner_pix_key?: string | null;
  relationship: string;
  color: string;
  status: 'invited' | 'accepted' | 'declined' | 'revoked';
}

export interface NeonSharedTransaction {
  sender_user_id: string;
  recipient_user_id: string;
  shared_sync_id: string;
  payload: Record<string, unknown>;
  updated_at: string;
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

export function createNeonWorkspace(
  payload: Record<string, unknown>
): Promise<{ revision: number; updatedAt: string }> {
  return authorizedRequest('/api/workspace', {
    method: 'POST',
    body: JSON.stringify({ payload }),
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

export async function loadNeonFamilyInvitations(): Promise<NeonFamilyInvitation[]> {
  const result = await authorizedRequest<{ invitations: NeonFamilyInvitation[] }>(
    '/api/family/invitations'
  );
  return result.invitations || [];
}

export function createNeonFamilyInvitation(input: {
  invitedEmail: string;
  ownerMemberId: string;
  ownerName: string;
  ownerPixKey?: string;
  relationship: string;
  color: string;
}): Promise<{ invitation: NeonFamilyInvitation }> {
  return authorizedRequest('/api/family/invitations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function respondToNeonFamilyInvitation(
  invitationId: string,
  action: 'accepted' | 'declined'
): Promise<{ invitation: NeonFamilyInvitation }> {
  return authorizedRequest(`/api/family/invitations/${encodeURIComponent(invitationId)}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export function revokeNeonFamilyInvitation(invitationId: string): Promise<{ ok: true }> {
  return authorizedRequest(
    `/api/family/invitations/${encodeURIComponent(invitationId)}/revoke`,
    { method: 'POST', body: '{}' }
  );
}

export async function loadNeonSharedTransactions(): Promise<Record<string, unknown>[]> {
  const result = await authorizedRequest<{ transactions: NeonSharedTransaction[] }>(
    '/api/family/shared'
  );
  return (result.transactions || []).map((row) => row.payload);
}

export function syncNeonSharedTransactions(input: {
  partnerEmail: string;
  transactions: Array<Record<string, unknown>>;
  deletedSharedIds?: string[];
}): Promise<{ ok: true; upserted: number; settled: number; deleted: number }> {
  return authorizedRequest('/api/family/shared', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
