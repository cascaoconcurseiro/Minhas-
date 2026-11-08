export function getVaultIdForUid(uid: string): string {
  const normalizedUid = uid.trim();
  if (!normalizedUid) throw new Error('UID do usuário obrigatório.');
  return `vault_uid_${normalizedUid}`;
}
