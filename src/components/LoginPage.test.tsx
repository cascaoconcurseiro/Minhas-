import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginPage } from './LoginPage';

function renderLoginPage() {
  return renderToStaticMarkup(
    React.createElement(LoginPage, {
      onSignInEmail: async () => {},
      onRegisterEmail: async () => {},
    })
  );
}

test('login renderiza acesso por e-mail e identifica Neon como provedor e banco', () => {
  const markup = renderLoginPage();

  assert.match(markup, /Acesse sua conta/);
  assert.match(markup, /data-testid="login-email-input"/);
  assert.match(markup, /data-testid="login-password-input"/);
  assert.match(markup, /Neon Auth protege o acesso/);
  assert.match(markup, /Neon PostgreSQL/);
  assert.doesNotMatch(markup, /Firebase Auth|Firestore/i);
});

test('login oferece o caminho de criação de conta sem dados de demonstração', () => {
  const markup = renderLoginPage();

  assert.match(markup, /Criar Nova Conta/);
  assert.match(markup, /Acesso protegido por autenticação/);
  assert.doesNotMatch(markup, /demo|mock|Guia Rápido|Quick Guide/i);
});
