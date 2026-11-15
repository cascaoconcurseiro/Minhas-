import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFamilyInviteMessage, buildWhatsAppInviteUrl, getFamilyInviteCreatedNotice, getFamilyInviteStatus } from './familyInvite';

test('mensagem do convite diz onde entrar, com qual e-mail e como aceitar', () => {
  const message = buildFamilyInviteMessage({ appUrl: 'https://app.example', email: 'fran@example.com' });
  assert.match(message, /https:\/\/app\.example/);
  assert.match(message, /fran@example\.com/);
  assert.match(message, /crie uma com esse mesmo e-mail/);
  assert.match(message, /aba Compartilhado/);
});

test('link do WhatsApp leva a mensagem codificada e não escolhe número', () => {
  const url = buildWhatsAppInviteUrl('Oi, tudo bem? https://app.example/?a=1&b=2');
  assert.ok(url.startsWith('https://wa.me/?text='));
  assert.equal(new URL(url).searchParams.get('text'), 'Oi, tudo bem? https://app.example/?a=1&b=2');
});

test('pessoa sem conta: aviso de atenção que manda criar a conta com o mesmo e-mail', () => {
  const status = getFamilyInviteStatus('fran@example.com', false);
  assert.equal(status.tone, 'warning');
  assert.match(status.title, /ainda não tem conta/i);
  assert.match(status.detail, /fran@example\.com/);
  assert.match(status.detail, /não envia e-mail/i);
});

test('pessoa com conta: só falta aceitar', () => {
  const status = getFamilyInviteStatus('fran@example.com', true);
  assert.equal(status.tone, 'info');
  assert.match(status.title, /já tem conta/i);
  assert.match(status.detail, /aceitar/i);
});

test('sem informação do servidor: texto neutro, sem afirmar que tem ou não conta', () => {
  const status = getFamilyInviteStatus('fran@example.com', undefined);
  assert.equal(status.tone, 'neutral');
  assert.doesNotMatch(`${status.title} ${status.detail}`, /ainda não tem conta|já tem conta/i);
  assert.match(status.detail, /não envia e-mail/i);
});

test('aviso ao registrar o convite muda conforme a pessoa tenha conta ou não', () => {
  assert.match(getFamilyInviteCreatedNotice('fran@example.com', false), /ainda não tem conta/);
  assert.match(getFamilyInviteCreatedNotice('fran@example.com', false), /Nenhum e-mail foi enviado/);
  assert.match(getFamilyInviteCreatedNotice('fran@example.com', true), /Ela já tem conta/);
  assert.match(getFamilyInviteCreatedNotice('fran@example.com', undefined), /Convite registrado no app para fran@example\.com\. Nenhum e-mail foi enviado/);
});
