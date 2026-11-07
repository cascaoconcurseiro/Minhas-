import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, {afterEach} from 'node:test';
import {createPwaUpdateGate} from './updateGate';

const gates: Array<ReturnType<typeof createPwaUpdateGate>> = [];

afterEach(() => {
  for (const gate of gates.splice(0)) gate.destroy();
  document.body.replaceChildren();
});

function createGate(applyUpdate: () => void, onDeferred?: (deferred: boolean) => void) {
  const gate = createPwaUpdateGate({document, applyUpdate, onDeferred});
  gates.push(gate);
  return gate;
}

test('defers a ready update while an edited financial field remains mounted, then applies after safe close', async () => {
  let updates = 0;
  const deferredStates: boolean[] = [];
  const form = document.createElement('form');
  const dialog = document.createElement('section');
  dialog.setAttribute('role', 'dialog');
  const input = document.createElement('input');
  input.value = 'Conta de teste';
  input.defaultValue = 'Conta de teste';
  dialog.append(input);
  form.append(dialog);
  document.body.append(form);

  const gate = createGate(() => { updates += 1; }, (deferred) => deferredStates.push(deferred));
  input.value = 'Conta alterada';
  input.dispatchEvent(new Event('input', {bubbles: true}));
  gate.updateAvailable();

  assert.equal(updates, 0, 'não recarrega enquanto o campo editado está aberto');
  assert.equal(deferredStates.at(-1), true, 'informa que a atualização está aguardando');

  dialog.remove();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(updates, 1, 'aplica a atualização depois que a edição foi fechada');
  assert.equal(deferredStates.at(-1), false);
});

test('applies a ready update immediately when no edited form is open', () => {
  let updates = 0;
  const gate = createGate(() => { updates += 1; });
  gate.updateAvailable();
  assert.equal(updates, 1);
});

test('does not defer a ready update for edited search and filter controls outside an edit form', () => {
  let updates = 0;
  const search = document.createElement('input');
  search.type = 'search';
  const filter = document.createElement('select');
  const option = document.createElement('option');
  option.value = 'all';
  option.defaultSelected = true;
  filter.append(option);
  document.body.append(search, filter);
  const gate = createGate(() => { updates += 1; });
  search.value = 'consulta';
  search.dispatchEvent(new Event('input', {bubbles: true}));
  filter.value = 'pending';
  filter.dispatchEvent(new Event('change', {bubbles: true}));
  gate.updateAvailable();
  assert.equal(updates, 1);
});

test('clears dirty fields after a form reset', async () => {
  let updates = 0;
  const form = document.createElement('form');
  const input = document.createElement('input');
  input.defaultValue = 'original';
  form.append(input);
  document.body.append(form);
  const gate = createGate(() => { updates += 1; });
  input.value = 'edited';
  input.dispatchEvent(new Event('input', {bubbles: true}));
  gate.updateAvailable();
  form.reset();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(updates, 1);
});

test('applies a pending update when a dialog closes while its dirty field remains mounted', async () => {
  let updates = 0;
  const dialog = document.createElement('dialog');
  const input = document.createElement('input');
  input.defaultValue = 'original';
  dialog.append(input);
  dialog.setAttribute('open', '');
  document.body.append(dialog);
  const gate = createGate(() => { updates += 1; });
  input.value = 'edited';
  input.dispatchEvent(new Event('input', {bubbles: true}));
  gate.updateAvailable();
  dialog.removeAttribute('open');
  dialog.dispatchEvent(new Event('close'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(updates, 1);
});

test('applies when a modal is hidden by CSS and keeps waiting while another dirty field stays visible', async () => {
  let updates = 0;
  const visible = document.createElement('input');
  visible.defaultValue = 'a';
  const form = document.createElement('form');
  form.append(visible);
  const modal = document.createElement('section');
  modal.setAttribute('role', 'dialog');
  const hidden = document.createElement('input');
  hidden.defaultValue = 'b';
  modal.append(hidden);
  document.body.append(form, modal);
  const gate = createGate(() => { updates += 1; });
  for (const field of [visible, hidden]) {
    field.value = 'edited';
    field.dispatchEvent(new Event('input', {bubbles: true}));
  }
  gate.updateAvailable();
  modal.style.display = 'none';
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(updates, 0, 'campo visível ainda impede a atualização');
  visible.value = visible.defaultValue;
  visible.dispatchEvent(new Event('input', {bubbles: true}));
  assert.equal(updates, 1, 'campo invisível não mantém a atualização bloqueada');
});

test('waits for every dirty field and recovers after applyUpdate rejects', async () => {
  let attempts = 0;
  const form = document.createElement('form');
  const fields = ['a', 'b'].map((value) => {
    const input = document.createElement('input');
    input.defaultValue = value;
    form.append(input);
    return input;
  });
  document.body.append(form);
  const gate = createGate(() => {
    attempts += 1;
    if (attempts === 1) return Promise.reject(new Error('temporary failure'));
  });
  for (const field of fields) {
    field.value += '-edited';
    field.dispatchEvent(new Event('input', {bubbles: true}));
  }
  gate.updateAvailable();
  fields[0].value = fields[0].defaultValue;
  fields[0].dispatchEvent(new Event('input', {bubbles: true}));
  assert.equal(attempts, 0);
  fields[1].value = fields[1].defaultValue;
  fields[1].dispatchEvent(new Event('input', {bubbles: true}));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(attempts, 1);
  gate.updateAvailable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(attempts, 2);
});
