import test from 'node:test';
import assert from 'node:assert/strict';
import { create } from 'zustand';
import { loadService } from './load-service.mjs';

test('an alert arriving during a picker waits in the same queue; unmount cancels without saving', async () => {
  const { AppDialog, useDialogStore } = loadService('appDialog', { zustand: { create } });
  let saved = false;
  const id = AppDialog.dateTime('date', new Date(2026, 11, 25), () => { saved = true; });
  AppDialog.alert('Network error', 'Try again');
  assert.equal(useDialogStore.getState().queue.length, 2);
  assert.equal(useDialogStore.getState().queue[0].dateTime.mode, 'date');
  AppDialog.dismiss(id);
  await new Promise(setImmediate);
  assert.equal(saved, false);
  assert.equal(useDialogStore.getState().queue[0].title, 'Network error');
});

test('dialogs queue without losing actions and reject duplicate confirmation presses', async () => {
  const { AppDialog, useDialogStore } = loadService('appDialog', { zustand: { create } });
  let deleted = 0;
  const action = { text: 'Delete', style: 'destructive', onPress: () => { deleted++; } };
  AppDialog.alert('Delete?', 'Confirm', [{ text: 'Cancel', style: 'cancel' }, action]);
  AppDialog.alert('Next');
  const id = useDialogStore.getState().queue[0].id;
  AppDialog.respond(id, action);
  AppDialog.respond(id, action);
  await new Promise(setImmediate);
  assert.equal(deleted, 1);
  assert.equal(useDialogStore.getState().queue[0].title, 'Next');
});

test('dismissal never executes a destructive action and async failures are shown', async () => {
  const { AppDialog, useDialogStore } = loadService('appDialog', { zustand: { create } });
  let deleted = false;
  AppDialog.alert('Delete?', '', [{ text: 'Delete', style: 'destructive', onPress: () => { deleted = true; } }]);
  AppDialog.respond(useDialogStore.getState().queue[0].id);
  await new Promise(setImmediate);
  assert.equal(deleted, false);
  assert.equal(useDialogStore.getState().queue.length, 0);
  const fail = { text: 'Save', onPress: async () => { throw new Error('Offline'); } };
  AppDialog.alert('Save?', '', [fail]);
  AppDialog.respond(useDialogStore.getState().queue[0].id, fail);
  await new Promise(setImmediate);
  assert.equal(useDialogStore.getState().queue[0].message, 'Offline');
});
