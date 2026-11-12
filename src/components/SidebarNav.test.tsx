import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { SidebarNav } from './SidebarNav';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderSidebar(
  isMobileDrawerOpen = false,
  cloudSyncStatus: 'local' | 'syncing' | 'synced' | 'error' = 'synced',
  onSelectTab: (tab: string) => void = () => {}
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(React.createElement(SidebarNav, {
      activeTab: 'overview',
      onSelectTab,
      isCollapsed: false,
      onToggleCollapse: () => {},
      isMobileDrawerOpen,
      onCloseMobileDrawer: () => {},
      onOpenNewTransaction: () => {},
      onOpenSettings: () => {},
      cloudSyncStatus,
    }));
  });
  return container;
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('desktop sidebar navigation exposes current page and visible keyboard focus', () => {
  const page = renderSidebar();
  const overview = page.querySelector<HTMLButtonElement>('button[aria-current="page"]');
  assert.ok(overview);
  assert.equal(overview.getAttribute('aria-label'), 'Visão geral');
  const brandLink = [...page.querySelectorAll<HTMLButtonElement>('[data-testid="desktop-sidebar"] button')]
    .find((button) => button.textContent?.includes('Minhas Economias'));
  assert.ok(brandLink);
  assert.match(brandLink.className, /focus-visible:ring/);
  brandLink.focus();
  assert.equal(document.activeElement, brandLink);
});

test('mobile drawer navigation buttons retain accessible text names', () => {
  const page = renderSidebar(true);
  const dialog = page.querySelector('[role="dialog"][aria-label="Menu de navegação"]');
  assert.ok(dialog);
  const navButton = [...dialog.querySelectorAll<HTMLButtonElement>('nav button')]
    .find((button) => button.textContent?.includes('Visão geral'));
  assert.ok(navButton);
  assert.match(navButton.textContent ?? '', /Visão geral/);
  navButton.focus();
  assert.equal(document.activeElement, navButton);
});

test('cloud sync status stays hidden during normal operation and opens cloud settings on error', () => {
  let selectedTab = '';
  const page = renderSidebar(false, 'synced', (tab) => { selectedTab = tab; });
  assert.equal(page.querySelector('[data-testid="sidebar-cloud-sync-status"]'), null);

  act(() => root?.unmount());
  root = null;
  const errorPage = renderSidebar(false, 'error', (tab) => { selectedTab = tab; });
  const alert = errorPage.querySelector<HTMLButtonElement>('[data-testid="sidebar-cloud-sync-status"]');
  assert.ok(alert);
  act(() => alert.click());
  assert.equal(selectedTab, 'cloud');
});
