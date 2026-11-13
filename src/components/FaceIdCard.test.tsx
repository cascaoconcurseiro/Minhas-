import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { FaceIdCard } from './FaceIdCard';
import { FaceIdOfferBanner } from './FaceIdOfferBanner';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;
const globals = globalThis as unknown as Record<string, unknown>;
const originalFetch = globalThis.fetch;
const originalPKC = globals.PublicKeyCredential;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  globalThis.fetch = originalFetch;
  if (originalPKC === undefined) delete globals.PublicKeyCredential;
  else globals.PublicKeyCredential = originalPKC;
  window.localStorage.clear();
  setUserAgent(originalUserAgent);
});

const originalUserAgent = navigator.userAgent;
function setUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', { value, configurable: true });
}
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';

function supportFaceId(supported: boolean) {
  setUserAgent(IPHONE_UA);
  const stub = { isUserVerifyingPlatformAuthenticatorAvailable: async () => supported };
  globals.PublicKeyCredential = stub;
  (window as unknown as Record<string, unknown>).PublicKeyCredential = stub;
}

async function mount(element: React.ReactElement) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(element);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  return container;
}

test('card explica quando o aparelho não tem Face ID', async () => {
  supportFaceId(false);
  const el = await mount(React.createElement(FaceIdCard));
  assert.ok(el.querySelector('[data-testid="face-id-unsupported"]'));
  assert.equal(el.querySelector('[data-testid="face-id-enable-btn"]'), null);
});

test('card oferece ativar quando há Face ID e ainda não foi ativado', async () => {
  supportFaceId(true);
  globalThis.fetch = (async () => new Response(JSON.stringify({ passkeys: [] }), { status: 200 })) as typeof fetch;
  const el = await mount(React.createElement(FaceIdCard));
  assert.ok(el.querySelector('[data-testid="face-id-enable-btn"]'));
});

test('convite aparece uma vez e some depois de dispensado', async () => {
  supportFaceId(true);
  let el = await mount(React.createElement(FaceIdOfferBanner));
  assert.ok(el.querySelector('[data-testid="face-id-offer"]'));
  const dismiss = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Agora não') as HTMLButtonElement;
  await act(async () => dismiss.click());
  assert.equal(el.querySelector('[data-testid="face-id-offer"]'), null);
  act(() => root?.unmount());
  el.remove();
  el = await mount(React.createElement(FaceIdOfferBanner));
  assert.equal(el.querySelector('[data-testid="face-id-offer"]'), null);
});

test('convite não aparece quando o aparelho não tem Face ID', async () => {
  supportFaceId(false);
  const el = await mount(React.createElement(FaceIdOfferBanner));
  assert.equal(el.querySelector('[data-testid="face-id-offer"]'), null);
});

test('ativar sem a preparação pronta avisa para tocar de novo, sem esperar a rede', async () => {
  const { registerPasskey, describePasskeyFailure } = await import('../lib/passkeyClient');
  let message = '';
  try {
    await registerPasskey();
  } catch (error) {
    message = (error as Error).message;
    assert.match(describePasskeyFailure(error), /PasskeyError/);
  }
  assert.match(message, /Preparando o Face ID/);
});

test('no computador o Face ID não é oferecido, mesmo com leitor biométrico', async () => {
  const stub = { isUserVerifyingPlatformAuthenticatorAvailable: async () => true };
  globals.PublicKeyCredential = stub;
  (window as unknown as Record<string, unknown>).PublicKeyCredential = stub;
  setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36');
  const { isPasskeySupported } = await import('../lib/passkeyClient');
  assert.equal(await isPasskeySupported(), false);
});
