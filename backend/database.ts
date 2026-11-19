/** Conexão com o Neon (pool) e transação com isolamento por usuário (RLS). */
import { Pool } from 'pg';
import { normalizeDatabaseConnectionString } from './databaseConnection.ts';
import { getVaultIdForUid } from '../shared/workspaceIdentity.ts';
import type { AuthUserIdentity } from './authUser.ts';

let neonPool: Pool | undefined;

export function getNeonPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada no servidor.');
  }
  if (!neonPool) {
    neonPool = new Pool({
      connectionString: normalizeDatabaseConnectionString(process.env.DATABASE_URL),
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    // O Neon encerra conexões ociosas (autosuspend). Sem este ouvinte, o erro de uma conexão parada
    // derruba o processo inteiro (evento 'error' sem tratamento) e a função responde 500.
    neonPool.on('error', (error) => {
      console.error('Conexão ociosa do Neon encerrada:', error instanceof Error ? error.message : error);
    });
  }
  return neonPool;
}

export async function withWorkspaceRls<T>(
  user: AuthUserIdentity,
  operation: (client: import('pg').PoolClient, vaultId: string) => Promise<T>
): Promise<T> {
  const vaultId = getVaultIdForUid(user.uid);
  const client = await getNeonPool().connect();
  let discardConnection = false;
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [user.uid]);
    await client.query("SELECT set_config('app.user_email', $1, true)", [
      user.email.toLowerCase(),
    ]);
    const result = await operation(client, vaultId);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Conexão quebrada: preserva o erro original e descarta a conexão em vez de devolvê-la ao pool.
      discardConnection = true;
    }
    throw error;
  } finally {
    client.release(discardConnection ? true : undefined);
  }
}
