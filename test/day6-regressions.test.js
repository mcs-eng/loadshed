'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const loadshedSource = fs.readFileSync(path.join(root, 'src', 'loadshed.js'), 'utf8');
const saleSource = fs.readFileSync(path.join(root, 'sale', 'index.html'), 'utf8');

function sandbox() {
  const clock = { now: 1000 };
  const observers = [];
  const intervals = new Map();
  const timeouts = new Map();
  let timerId = 0;
  class FakePerformanceObserver {
    static supportedEntryTypes = ['longtask', 'event'];
    constructor(callback) { this.callback = callback; this.type = null; observers.push(this); }
    observe(options) { this.type = options.type; }
    disconnect() { this.disconnected = true; }
  }
  const window = {};
  window.window = window;
  window.parent = window;
  const context = {
    window,
    document: {},
    performance: { now: () => clock.now },
    PerformanceObserver: FakePerformanceObserver,
    AbortController,
    setInterval(callback, milliseconds) { const id = ++timerId; intervals.set(id, { callback, milliseconds }); return id; },
    clearInterval(id) { intervals.delete(id); },
    setTimeout(callback, milliseconds) { const id = ++timerId; timeouts.set(id, { callback, milliseconds }); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    Date, JSON, Math, Number, Object, Set, TypeError, Error, String, Array
  };
  vm.createContext(context);
  vm.runInContext(loadshedSource, context, { filename: 'src/loadshed.js' });
  return { clock, observers, intervals, timeouts, window };
}

function observer(env, type) {
  const item = env.observers.find((candidate) => candidate.type === type);
  assert.ok(item, `missing ${type} observer`);
  return item;
}

function runtimeIn(env) {
  const elements = [
    { id: 'always', label: 'Always protected', neverShed: true },
    { id: 'crowd', label: 'Crowd' }
  ];
  const ladder = [
    { id: 'crowd', label: 'Crowd', order: 1, shed: () => {}, restore: () => {} }
  ];
  return env.window.Loadshed.create({
    elements,
    ladder,
    visiblePressureMs: 0,
    persistedPressureMs: 10000
  }).start();
}

function cutCrowd(env, seam) {
  env.clock.now = 999;
  seam.setBusyworkLevel(100);
  observer(env, 'event').callback({ getEntries: () => [
    { name: 'click', interactionId: 1, duration: 120, startTime: 999 }
  ] });
  env.clock.now = 1000;
  observer(env, 'longtask').callback({ getEntries: () => [
    { duration: 55, startTime: 1000 }, { duration: 55, startTime: 1000 }
  ] });
  const receipt = seam.getSnapshot().receipts.find((item) => item.kind === 'shed' && item.shed.stepId === 'crowd');
  assert.ok(receipt, 'the crowd cut did not happen');
  return receipt;
}

test('a click after full restoration cannot rewrite the historical cut comparison', () => {
  const env = sandbox();
  const runtime = runtimeIn(env);
  const seam = runtime.testSeam();
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true });
  const receipt = cutCrowd(env, seam);
  assert.equal(receipt.interaction.afterMs, null, 'no after-click exists yet');
  const off = seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: false });
  assert.equal(off.ok, true, 'turning the promise off restores the ladder');
  env.clock.now = 5000;
  observer(env, 'event').callback({ getEntries: () => [
    { name: 'click', interactionId: 2, duration: 8, startTime: 5000 }
  ] });
  const snapshot = seam.getSnapshot();
  const shedAfter = snapshot.receipts.find((item) => item.kind === 'shed' && item.shed.stepId === 'crowd');
  assert.equal(shedAfter.interaction.afterMs, null, 'the post-restoration click must not become after-cut evidence');
  const fabricated = snapshot.receipts.find((item) => item.kind === 'measurement' && item.shedReceiptId === shedAfter.id);
  assert.equal(fabricated, undefined, 'no measurement receipt may compare a click with a restored cut');
  runtime.stop();
});

test('an active promise can renegotiate its ceiling while its only relief step is cut', () => {
  const env = sandbox();
  const runtime = runtimeIn(env);
  const seam = runtime.testSeam();
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true });
  cutCrowd(env, seam);
  const renegotiated = seam.setSmoothnessContract({ maxInteractionLatencyMs: 150, protectedElement: 'always', active: true });
  assert.equal(renegotiated.ok, true, 'renegotiation must not be refused while the relief step is temporarily cut');
  assert.equal(renegotiated.promise.maxInteractionLatencyMs, 150);
  runtime.stop();
});

test('the sale click readout uses nullish coalescing so a 0 ms after-click is not replaced', () => {
  assert.match(saleSource, /latest\.afterMs \?\? latest\.beforeMs/, 'sale readout must use ?? for the after-click value');
});
