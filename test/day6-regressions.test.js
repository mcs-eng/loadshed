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

function runtimeIn(env, overrides = {}) {
  const { elements: customElements, ladder: customLadder, ...options } = overrides;
  const elements = customElements || [
    { id: 'always', label: 'Always protected', neverShed: true },
    { id: 'crowd', label: 'Crowd' }
  ];
  const ladder = customLadder || [
    { id: 'crowd', label: 'Crowd', order: 1, shed: () => {}, restore: () => {} }
  ];
  return env.window.Loadshed.create({
    elements,
    ladder,
    visiblePressureMs: 0,
    persistedPressureMs: 10000,
    ...options
  }).start();
}

function trustedClick(env, interactionId, duration, startTime) {
  env.clock.now = startTime;
  observer(env, 'event').callback({ getEntries: () => [
    { name: 'click', interactionId, duration, startTime }
  ] });
}

function twoHitches(env, startTime) {
  env.clock.now = startTime;
  observer(env, 'longtask').callback({ getEntries: () => [
    { duration: 55, startTime }, { duration: 55, startTime }
  ] });
}

function agentTool(runtime, name) {
  const tool = runtime.toolDefinitions().find((item) => item.name === name);
  assert.ok(tool, `missing tool ${name}`);
  return tool;
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

test('a trusted click while the cut is still open completes the before/after comparison', () => {
  const env = sandbox();
  const runtime = runtimeIn(env);
  const seam = runtime.testSeam();
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true });
  const receipt = cutCrowd(env, seam);
  assert.ok(receipt.evidenceGaps.includes('Ask for one trusted click after the last cut to complete the comparison.'));
  trustedClick(env, 2, 8, 2000);
  const snapshot = seam.getSnapshot();
  const shed = snapshot.receipts.find((item) => item.id === receipt.id);
  assert.equal(shed.interaction.afterMs, 8);
  const measurements = snapshot.receipts.filter((item) => item.kind === 'measurement' && item.shedReceiptId === receipt.id);
  assert.equal(measurements.length, 1);
  assert.match(measurements[0].summary, /120 ms before, 8 ms after/);
  runtime.stop();
});

test('a manual cut after restoration does not reopen the old automatic cut comparison', () => {
  const env = sandbox();
  const runtime = runtimeIn(env);
  const seam = runtime.testSeam();
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true });
  const receipt = cutCrowd(env, seam);
  const off = seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: false });
  assert.equal(off.ok, true);
  assert.ok(seam.getSnapshot().evidenceGaps.includes('The last cut was restored before a trusted after-click was captured; that comparison stays incomplete.'));
  env.clock.now = 5000;
  const manual = seam.applyAdaptation({ stepId: 'crowd', action: 'shed' });
  assert.equal(manual.ok, true);
  trustedClick(env, 2, 8, 6000);
  const snapshot = seam.getSnapshot();
  const shed = snapshot.receipts.find((item) => item.id === receipt.id);
  assert.equal(shed.interaction.afterMs, null, 'the old automatic cut must not absorb a click taken during a later manual cut');
  assert.equal(snapshot.receipts.find((item) => item.kind === 'measurement' && item.shedReceiptId === receipt.id), undefined);
  runtime.stop();
});

test('a throwing page callback cannot turn a completed agent tool call into a failure', async () => {
  const env = sandbox();
  let receiptCalls = 0;
  const runtime = runtimeIn(env, {
    onReceipt: () => { receiptCalls += 1; if (receiptCalls === 1) throw new Error('page render bug'); },
    onState: () => { throw new Error('page state bug'); }
  });
  const result = await agentTool(runtime, 'set_smoothness_contract').execute({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true });
  assert.equal(result.ok, true, result.summary);
  assert.equal(typeof result.receiptId, 'number');
  const snapshot = runtime.testSeam().getSnapshot();
  assert.equal(snapshot.promise.active, true);
  assert.equal(snapshot.receipts.filter((item) => item.kind === 'contract').length, 1);
  runtime.stop();
});

test('a shedable ladder step without both callbacks is rejected at construction', () => {
  const env = sandbox();
  const elements = [{ id: 'always', label: 'Always protected', neverShed: true }, { id: 'crowd', label: 'Crowd' }, { id: 'fixed', label: 'Fixed' }];
  assert.throws(
    () => env.window.Loadshed.create({ elements, ladder: [{ id: 'crowd', label: 'Crowd', order: 1, restore: () => {} }] }),
    { name: 'TypeError', message: /shed and restore functions: crowd/ }
  );
  assert.throws(
    () => env.window.Loadshed.create({ elements, ladder: [{ id: 'crowd', label: 'Crowd', order: 1, shed: () => {} }] }),
    { name: 'TypeError', message: /shed and restore functions: crowd/ }
  );
  const runtime = env.window.Loadshed.create({ elements, ladder: [
    { id: 'crowd', label: 'Crowd', order: 1, shed: () => {}, restore: () => {} },
    { id: 'fixed', label: 'Fixed', order: 2, shedable: false }
  ] });
  assert.equal(runtime.testSeam().adaptationOptions().ladder.length, 2);
});

test('a third automatic cut names the most recent previous cut, not the ladder-first one', () => {
  const env = sandbox();
  const runtime = runtimeIn(env, {
    elements: [{ id: 'always', label: 'Always protected', neverShed: true }, { id: 'crowd', label: 'Alpha' }, { id: 'beta', label: 'Beta' }, { id: 'gamma', label: 'Gamma' }],
    ladder: [
      { id: 'crowd', label: 'Alpha', order: 1, shed: () => {}, restore: () => {} },
      { id: 'beta', label: 'Beta', order: 2, shed: () => {}, restore: () => {} },
      { id: 'gamma', label: 'Gamma', order: 3, shed: () => {}, restore: () => {} }
    ]
  });
  const seam = runtime.testSeam();
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true });
  cutCrowd(env, seam);
  trustedClick(env, 2, 150, 2000);
  twoHitches(env, 2100);
  trustedClick(env, 3, 150, 3200);
  twoHitches(env, 3300);
  const summaries = seam.getSnapshot().receipts.filter((item) => item.kind === 'shed').map((item) => item.summary).reverse();
  assert.equal(summaries.length, 3);
  assert.match(summaries[1], /^Alpha cut did not clear the hitches; cutting Beta\./);
  assert.match(summaries[2], /^Beta cut did not clear the hitches; cutting Gamma\./);
  runtime.stop();
});

test('both demo toggles revert refused changes and Sale hides its inactive agent marker', () => {
  const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const [name, source] of [['index.html', indexSource], ['sale/index.html', saleSource]]) {
    assert.match(source, /ui\.promiseToggle\.checked = !active;/, `${name} must revert the toggle to the opposite of the refused request`);
    assert.doesNotMatch(source, /if \(!result\.ok\) \{\s*ui\.promiseToggle\.checked = false;/, `${name} must not force the toggle off after a refused off-switch`);
  }
  assert.match(
    saleSource,
    /\.agent-promise\[hidden\]\s*\{\s*display:\s*none;/,
    'Sale CSS must not override the marker hidden attribute when tools or the promise are inactive'
  );
});

test('restoreAll validates its caller like every other mutator', () => {
  assert.match(loadshedSource, /restoreAll\(caller = 'page-control'\) \{\s*ensureCaller\(caller\);/);
});

test('sinceIso accepts only ISO 8601 instants and filters from the epoch correctly', () => {
  const env = sandbox();
  const runtime = runtimeIn(env);
  const seam = runtime.testSeam();
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true });
  const all = seam.interventionReceipts({}).receipts.length;
  assert.ok(all >= 1);
  assert.equal(seam.interventionReceipts({ sinceIso: '1970-01-01T00:00:00.000Z' }).receipts.length, all);
  assert.equal(seam.interventionReceipts({ sinceIso: '2999-01-01T00:00:00.000Z' }).receipts.length, 0);
  assert.throws(() => seam.interventionReceipts({ sinceIso: 'March 5, 2026' }), { message: /ISO date string/ });
  assert.throws(() => seam.interventionReceipts({ sinceIso: '2026-13-45T99:99:99Z' }), { message: /ISO date string/ });
  runtime.stop();
});

test('receipt growth cannot stretch the protected Desk canvas', () => {
  const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(
    indexSource,
    /\.stage \{[^}]*align-self:start;/,
    'the Desk stage must opt out of grid-row stretching so receipt history cannot enlarge its animated canvases'
  );
});
