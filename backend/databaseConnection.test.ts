import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDatabaseConnectionString } from './databaseConnection';

test('makes the current certificate and hostname verification explicit for legacy pg ssl modes', () => {
  for (const sslMode of ['prefer', 'require', 'verify-ca']) {
    const normalized = new URL(normalizeDatabaseConnectionString(
      `postgresql://user:p%40ss@db.example.com/neondb?sslmode=${sslMode}&application_name=minhas`,
    ));
    assert.equal(normalized.searchParams.get('sslmode'), 'verify-full');
    assert.equal(normalized.searchParams.get('application_name'), 'minhas');
    assert.equal(normalized.username, 'user');
    assert.equal(normalized.password, 'p%40ss');
  }
});

test('leaves URLs unchanged when no legacy SSL mode needs normalization', () => {
  const urls = [
    'postgres://user:password@db.example.com/neondb',
    'postgres://user:password@db.example.com/neondb?sslmode=verify-full',
    'postgres://user:password@db.example.com/neondb?sslmode=disable',
    'postgres://user:password@db.example.com/neondb?sslmode=require&uselibpqcompat=true',
    'not-a-database-url',
  ];
  for (const connectionString of urls) {
    assert.equal(normalizeDatabaseConnectionString(connectionString), connectionString);
  }
});
