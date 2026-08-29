'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const loadshedSource = fs.readFileSync(path.join(root, 'src', 'loadshed.js'), 'utf8');
const saleLatenessSource = fs.readFileSync(path.join(root, 'src', 'sale-lateness.js'), 'utf8');
const rootDeskSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function sandbox({ iframe = false, modelContext = null } = {}) {
  const clock = { now: 1000 };
  const observers = [];
  const timers = new Map();
  let timerId = 0;
  class FakePerformanceObserver {
    static supportedEntryTypes = ['longtask', 'event'];
    constructor(callback) { this.callback = callback; this.type = null; observers.push(this); }
    observe(options) { this.type = options.type; }
    disconnect() { this.disconnected = true; }
  }
  const window = {};
  window.window = window;
  window.parent = iframe ? {} : window;
  const context = {
    window,
    document: { modelContext },
    performance: { now: () => clock.now },
    PerformanceObserver: FakePerformanceObserver,
    AbortController,
    setInterval(callback, milliseconds) { const id = ++timerId; timers.set(id, { callback, milliseconds }); return id; },
    clearInterval(id) { timers.delete(id); },
    Date,
    JSON,
    Math,
    Number,
    Object,
    Set,
    TypeError,
    Error,
    String,
    Array
  };
  vm.createContext(context);
  vm.runInContext(loadshedSource, context, { filename: 'src/loadshed.js' });
  return { clock, observers, timers, window, context };
}

function runtimeIn(env, onState = () => {}) {
  return env.window.Loadshed.create({
    elements: [{ id: 'protected', label: 'Protected', neverShed: true }, { id: 'noise', label: 'Noise' }],
    ladder: [{ id: 'noise', label: 'Noise', order: 1, shed: () => {}, restore: () => {} }],
    onState
  });
}

function observer(env, type) {
  const item = env.observers.find((candidate) => candidate.type === type);
  assert.ok(item, `missing ${type} observer`);
  return item;
}

test('heartbeat restores after pressure clears without another observer event or idle state churn', () => {
  const env = sandbox();
  let stateChanges = 0;
  const runtime = runtimeIn(env, () => { stateChanges += 1; }).start();
  const seam = runtime.testSeam();
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'protected', active: true });
  seam.applyAdaptation({ stepId: 'noise', action: 'shed' });
  seam.setBusyworkLevel(0);
  const beforeHeartbeat = stateChanges;
  const heartbeat = [...env.timers.values()].find((timer) => timer.milliseconds === 350);
  assert.ok(heartbeat);
  env.clock.now += 699;
  heartbeat.callback();
  assert.equal(stateChanges, beforeHeartbeat);
  env.clock.now += 1;
  heartbeat.callback();
  assert.equal(seam.getSnapshot().steps[0].currentlyShed, false);
  assert.equal(stateChanges, beforeHeartbeat + 1);
  runtime.stop();
  assert.equal(env.timers.size, 0);
});

test('history keeps only the newest 300 frames and 200 interactions and receipts', () => {
  const env = sandbox();
  const runtime = runtimeIn(env).start();
  const seam = runtime.testSeam();
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'protected', active: true });
  observer(env, 'longtask').callback({ getEntries: () => Array.from({ length: 301 }, (_, index) => ({ duration: 55, startTime: index, })) });
  observer(env, 'event').callback({ getEntries: () => Array.from({ length: 201 }, (_, index) => ({ name: 'click', interactionId: index + 1, duration: 20, startTime: index })) });
  for (let index = 0; index < 205; index += 1) seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'protected', active: true });
  const snapshot = seam.getSnapshot();
  assert.equal(seam.inspect().frame.hitchCount50ms, 300);
  assert.equal(seam.inspect().interaction.trustedCount, 200);
  assert.equal(snapshot.receipts.length, 200);
  assert.equal(snapshot.receipts[0].id, 206);
  runtime.stop();
});

test('only click-class id-0 entries count as rejected injected input', () => {
  const env = sandbox();
  const runtime = runtimeIn(env).start();
  observer(env, 'event').callback({ getEntries: () => [
    { name: 'scroll', interactionId: 0, duration: 1, startTime: 1 },
    { name: 'pointermove', interactionId: 0, duration: 1, startTime: 2 },
    { name: 'click', interactionId: 0, duration: 1, startTime: 3 },
    { name: 'pointerdown', interactionId: 0, duration: 1, startTime: 4 },
    { name: 'keydown', interactionId: 0, duration: 1, startTime: 5 }
  ] });
  const snapshot = runtime.testSeam().getSnapshot();
  assert.equal(snapshot.interaction.rawCount, 3);
  assert.equal(snapshot.interaction.untrustedRejectedCount, 3);
  assert.equal(snapshot.receipts.filter((receipt) => receipt.summary.startsWith('Rejected injected')).length, 1);
  runtime.stop();
});

test('sale lateness is based on event and handler timestamps, not promise state', () => {
  const context = { window: {} };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(saleLatenessSource, context, { filename: 'src/sale-lateness.js' });
  assert.equal(context.window.SaleLateness.handlerDelayMs(950, 1000), 50);
  assert.equal(context.window.SaleLateness.isLate(950, 1000, 100), false);
  assert.equal(context.window.SaleLateness.handlerDelayMs(850, 1000), 150);
  assert.equal(context.window.SaleLateness.isLate(850, 1000, 100), true);
  assert.equal(context.window.SaleLateness.handlerDelayMs(0, 1000), 0);
});

test('iframes record a top-level-only registration skip', () => {
  let registered = 0;
  const env = sandbox({ iframe: true, modelContext: { registerTool() { registered += 1; } } });
  const runtime = runtimeIn(env).start();
  const snapshot = runtime.testSeam().getSnapshot();
  assert.equal(registered, 0);
  assert.equal(snapshot.registration.status, 'skipped');
  assert.match(snapshot.receipts[0].summary, /iframe/);
  runtime.stop();
});

test('canonical desk markup retains every declared protected element', () => {
  for (const id of ['live-trace', 'mixer', 'promise-card', 'receipt-rail']) {
    assert.match(rootDeskSource, new RegExp(`id="${id}"`));
  }
});

test('registered tools receive abort support, unregister on stop, and return objects', async () => {
  const registered = [];
  let cleanupCalls = 0;
  const env = sandbox({ modelContext: { registerTool(tool, options) { registered.push({ tool, options }); return () => { cleanupCalls += 1; }; } } });
  const runtime = runtimeIn(env).start();
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
  assert.equal(registered.length, 6);
  assert.equal(registered[0].options.signal.aborted, false);
  const result = await registered[0].tool.execute({});
  assert.equal(typeof result, 'object');
  assert.equal(result.ok, true);
  runtime.stop();
  assert.equal(cleanupCalls, 6);
  assert.equal(registered[0].options.signal.aborted, true);
  assert.equal(runtime.testSeam().getSnapshot().registration.status, 'stopped');
});

test('partial tool registration failure cleans up before reporting the error', async () => {
  let calls = 0;
  let cleanupCalls = 0;
  const env = sandbox({ modelContext: { registerTool() {
    calls += 1;
    if (calls === 2) throw new Error('registration failed');
    return () => { cleanupCalls += 1; };
  } } });
  const runtime = runtimeIn(env).start();
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
  const registration = runtime.testSeam().getSnapshot().registration;
  assert.equal(registration.status, 'error');
  assert.deepEqual(registration.registeredTools, []);
  assert.equal(cleanupCalls, 1);
  runtime.stop();
});

test('stop remains terminal when an in-flight registration resolves late', async () => {
  let resolveRegistration;
  let cleanupCalls = 0;
  const pending = new Promise((resolve) => { resolveRegistration = resolve; });
  const env = sandbox({ modelContext: { registerTool() { return pending; } } });
  const runtime = runtimeIn(env).start();
  runtime.stop();
  assert.equal(runtime.testSeam().getSnapshot().registration.status, 'stopped');
  resolveRegistration(() => { cleanupCalls += 1; });
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
  assert.equal(runtime.testSeam().getSnapshot().registration.status, 'stopped');
  assert.equal(cleanupCalls, 1);
});
