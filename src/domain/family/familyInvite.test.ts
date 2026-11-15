import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFamilyInviteMessage,
  buildWhatsAppInviteUrl,
  formatFamilyInviteCodeInput,
  getFamilyInviteCreatedNotice,
  getFamilyInviteStatus,
  isFamilyInviteCodeComplete,
} from './familyInvite';

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

test('a mensagem do convite leva o código quando ele existe', () => {
  const withCode = buildFamilyInviteMessage({ appUrl: 'https://app.example', email: 'fran@example.com', code: 'AB3D-EF4H' });
  assert.match(withCode, /Código do convite: AB3D-EF4H/);
  assert.match(withCode, /vai digitar para aceitar/);
  assert.doesNotMatch(buildFamilyInviteMessage({ appUrl: 'https://app.example', email: 'fran@example.com' }), /Código do convite/);
});

test('o que a pessoa digita vira o código em maiúsculas com hífen no meio', () => {
  assert.equal(formatFamilyInviteCodeInput('ab3d'), 'AB3D');
  assert.equal(formatFamilyInviteCodeInput('ab3def4h'), 'AB3D-EF4H');
  assert.equal(formatFamilyInviteCodeInput(' ab3d - ef4h '), 'AB3D-EF4H');
  assert.equal(formatFamilyInviteCodeInput('ab3d-ef4h-9999'), 'AB3D-EF4H', 'corta o que passa de 8');
  assert.equal(formatFamilyInviteCodeInput('!!'), '');
});

test('o código só está completo com 8 letras ou números', () => {
  assert.equal(isFamilyInviteCodeComplete('AB3D-EF4H'), true);
  assert.equal(isFamilyInviteCodeComplete('ab3def4h'), true);
  assert.equal(isFamilyInviteCodeComplete('AB3D-EF4'), false);
  assert.equal(isFamilyInviteCodeComplete(''), false);
});
