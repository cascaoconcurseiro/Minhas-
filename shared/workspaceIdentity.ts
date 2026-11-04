export function getVaultIdForUid(uid: string): string {
  const normalizedUid = uid.trim();
  if (!normalizedUid) throw new Error('UID Firebase obrigatório.');
  return `vault_uid_${normalizedUid}`;
}

export function getLegacyVaultIdForEmail(email: string | null | undefined): string {
  if (!email || !email.trim()) return 'vault_default_session_br_01';
  const cleanSlug = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const candidate = `vault_usr_${cleanSlug}`;
  const padded =
    candidate.length < 18 ? `${candidate}_cloud_vault_br` : candidate;
  return padded.slice(0, 60);
}
