'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const loadshedSource = fs.readFileSync(path.join(root, 'src', 'loadshed.js'), 'utf8');
const rootDeskSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const saleSource = fs.readFileSync(path.join(root, 'sale', 'index.html'), 'utf8');
const pickerSource = fs.readFileSync(path.join(root, 'picker', 'index.html'), 'utf8');

function sandbox({ performanceObserver = true } = {}) {
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
    PerformanceObserver: performanceObserver ? FakePerformanceObserver : undefined,
    AbortController,
    setInterval(callback, milliseconds) { const id = ++timerId; intervals.set(id, { callback, milliseconds }); return id; },
    clearInterval(id) { intervals.delete(id); },
    setTimeout(callback, milliseconds) { const id = ++timerId; timeouts.set(id, { callback, milliseconds }); return id; },
    clearTimeout(id) { timeouts.delete(id); },
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
  return { clock, observers, intervals, timeouts, window };
}

function observer(env, type) {
  const item = env.observers.find((candidate) => candidate.type === type);
  assert.ok(item, `missing ${type} observer`);
  return item;
}

function runtimeIn(env, { twoSteps = false, controller = {}, restoreCrowd = () => {}, restoreExtraTiles = () => {} } = {}) {
  const elements = [
    { id: 'always', label: 'Always protected', neverShed: true },
    { id: 'agent-protected', label: 'Agent protected' },
    { id: 'crowd', label: 'Crowd' },
    { id: 'extra-tiles', label: 'Extra tiles' }
  ];
  const ladder = [
    { id: 'crowd', label: 'Crowd', order: 1, shed: () => {}, restore: restoreCrowd },
    ...(twoSteps ? [{ id: 'extra-tiles', label: 'Extra tiles', order: 2, shed: () => {}, restore: restoreExtraTiles }] : [])
  ];
  return env.window.Loadshed.create({
    elements,
    ladder,
    visiblePressureMs: 0,
    persistedPressureMs: 10000,
    ...controller
  }).start();
}

function shedReceipt(snapshot, stepId) {
  return snapshot.receipts.find((receipt) => receipt.kind === 'shed' && receipt.shed.stepId === stepId);
}

test('a second automatic cut needs the dwell and hitches observed after the first cut', () => {
  const env = sandbox();
  const runtime = runtimeIn(env, { twoSteps: true });
  const seam = runtime.testSeam();
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true });
  env.clock.now = 999;
  seam.setBusyworkLevel(100);
  observer(env, 'event').callback({ getEntries: () => [
    { name: 'click', interactionId: 1, duration: 120, startTime: 999 }
  ] });
  env.clock.now = 1000;
  observer(env, 'longtask').callback({ getEntries: () => [
    { duration: 55, startTime: 1000 }, { duration: 55, startTime: 1000 }
  ] });
  assert.equal(shedReceipt(seam.getSnapshot(), 'crowd')?.shed.stepId, 'crowd');
  observer(env, 'longtask').callback({ getEntries: () => [] });
  assert.equal(shedReceipt(seam.getSnapshot(), 'extra-tiles'), undefined, 'the same hitch burst cannot cascade');
  env.clock.now += 899;
  observer(env, 'longtask').callback({ getEntries: () => [] });
  assert.equal(shedReceipt(seam.getSnapshot(), 'extra-tiles'), undefined, 'the 900 ms dwell has not elapsed');
  env.clock.now += 1;
  observer(env, 'longtask').callback({ getEntries: () => [
    { duration: 55, startTime: 1900 }, { duration: 55, startTime: 1900 }
  ] });
  assert.equal(shedReceipt(seam.getSnapshot(), 'extra-tiles')?.shed.stepId, 'extra-tiles');
  runtime.stop();
});

test('a trusted post-shed breach can justify the next cut after dwell and names that interaction', () => {
  const env = sandbox();
  const runtime = runtimeIn(env, { twoSteps: true });
  const seam = runtime.testSeam();
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true });
  env.clock.now = 999;
  seam.setBusyworkLevel(100);
  observer(env, 'event').callback({ getEntries: () => [
    { name: 'click', interactionId: 41, duration: 120, startTime: 999 }
  ] });
  env.clock.now = 1000;
  observer(env, 'longtask').callback({ getEntries: () => [
    { duration: 55, startTime: 1000 }, { duration: 55, startTime: 1000 }
  ] });
  assert.equal(shedReceipt(seam.getSnapshot(), 'crowd')?.shed.stepId, 'crowd');
  observer(env, 'event').callback({ getEntries: () => [
    { name: 'click', interactionId: 42, duration: 140, startTime: 1001 }
  ] });
  env.clock.now += 900;
  observer(env, 'longtask').callback({ getEntries: () => [
    { duration: 55, startTime: 1900 }, { duration: 55, startTime: 1900 }
  ] });
  const second = shedReceipt(seam.getSnapshot(), 'extra-tiles');
  assert.ok(second);
  assert.match(second.summary, /Crowd cut did not clear the hitches; cutting Extra tiles/);
  assert.match(second.summary, /interaction 42.*140 ms/);
  runtime.stop();
});

test('trusted sub-16 ms clicks fall back to page-measured timing without replacing Event Timing or accepting injected clicks', () => {
  const env = sandbox();
  const runtime = runtimeIn(env);
  const seam = runtime.testSeam();
  assert.equal(seam.recordPageMeasuredClick({ isTrusted: true, timeStamp: 994 }), true);
  env.clock.now = 1080;
  const fallback = [...env.timeouts.values()].find((timer) => timer.milliseconds === 80);
  assert.ok(fallback);
  fallback.callback();
  let latest = seam.getSnapshot().interaction.latestTrusted;
  assert.equal(latest.trust, 'page-measured');
  assert.equal(latest.durationMs, 6, 'the fallback reports latency at handler entry, not its 80 ms wait');
  assert.equal(latest.label, 'your click - 6 ms (page-measured; the browser reports only clicks over 16 ms)');

  env.clock.now = 1100;
  assert.equal(seam.recordPageMeasuredClick({ isTrusted: true, timeStamp: 1090 }), true);
  observer(env, 'event').callback({ getEntries: () => [
    { name: 'click', interactionId: 7, duration: 21, startTime: 1090 }
  ] });
  const observerFirstFallback = [...env.timeouts.values()].find((timer) => timer.milliseconds === 80);
  observerFirstFallback.callback();
  const samples = seam.inspect().interaction;
  assert.equal(samples.trustedCount, 2);
  assert.equal(samples.latestTrusted.trust, 'trusted-user');
  assert.equal(samples.latestTrusted.durationMs, 21);
  assert.equal(seam.recordPageMeasuredClick({ isTrusted: false, timeStamp: 1100 }), false);
  assert.equal(seam.inspect().interaction.trustedCount, 2);
  runtime.stop();
});

test('the same bubbling click schedules only one page-measured sample', () => {
  const env = sandbox();
  const runtime = runtimeIn(env);
  const seam = runtime.testSeam();
  const event = { isTrusted: true, timeStamp: 995 };
  assert.equal(seam.recordPageMeasuredClick(event), true);
  assert.equal(seam.recordPageMeasuredClick(event), true);
  assert.equal([...env.timeouts.values()].filter((timer) => timer.milliseconds === 80).length, 1);
  env.clock.now = 1080;
  [...env.timeouts.values()].find((timer) => timer.milliseconds === 80).callback();
  assert.equal(seam.inspect().interaction.trustedCount, 1);
  runtime.stop();
});

test('an agent-protected non-ladder element can back a contract while a ladder target returns a refusal receipt', () => {
  const env = sandbox();
  const runtime = runtimeIn(env);
  const seam = runtime.testSeam();
  assert.equal(seam.protectExperienceElement({ elementId: 'agent-protected', protect: true }).ok, true);
  assert.equal(seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'agent-protected', active: true }).ok, true);
  const refusal = seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'crowd', active: true });
  assert.equal(refusal.ok, false);
  assert.match(refusal.summary, /pin or remove the step/i);
  const ladderProtection = seam.protectExperienceElement({ elementId: 'crowd', protect: true });
  assert.equal(ladderProtection.ok, false);
  assert.match(ladderProtection.summary, /busywork.*pin it instead/i);
  assert.equal(seam.getSnapshot().receipts[0].kind, 'refusal');
  runtime.stop();
});

test('a contract snapshot names the exact element that backs the promise', () => {
  const env = sandbox();
  const runtime = runtimeIn(env);
  const seam = runtime.testSeam();
  seam.protectExperienceElement({ elementId: 'agent-protected', protect: true });
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 175, protectedElement: 'agent-protected', active: true });
  assert.equal(seam.getSnapshot().promise.protectedElement, 'agent-protected');
  assert.equal(seam.getSnapshot().promise.protectedLabel, 'Agent protected');
  runtime.stop();
});

test('a failed restore refuses to turn off the promise or claim full fidelity', () => {
  const env = sandbox();
  const runtime = runtimeIn(env, { restoreCrowd: () => { throw new Error('restore failed'); } });
  const seam = runtime.testSeam();
  assert.equal(
    seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true }).ok,
    true
  );
  assert.equal(seam.applyAdaptation({ stepId: 'crowd', action: 'shed' }).ok, true);
  observer(env, 'event').callback({ getEntries: () => [
    { name: 'click', interactionId: 1, duration: 20, startTime: 1000 }
  ] });

  const result = seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: false });

  assert.equal(result.ok, false);
  assert.match(result.summary, /cannot turn off until all cut steps are restored/i);
  assert.equal(seam.getSnapshot().promise.active, true);
  assert.equal(seam.getSnapshot().steps.find((step) => step.id === 'crowd').currentlyShed, true);
  assert.doesNotMatch(seam.inspect().summary, /full.fidelity/i);
  runtime.stop();
});

test('restoreAll stops at the first reverse-order failure and retries the intact ladder', () => {
  const env = sandbox();
  const restored = [];
  let failExtraTiles = true;
  const runtime = runtimeIn(env, {
    twoSteps: true,
    restoreCrowd: () => restored.push('crowd'),
    restoreExtraTiles: () => {
      restored.push('extra-tiles');
      if (failExtraTiles) throw new Error('restore failed');
    }
  });
  const seam = runtime.testSeam();
  assert.equal(
    seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true }).ok,
    true
  );
  assert.equal(seam.applyAdaptation({ stepId: 'crowd', action: 'shed' }).ok, true);
  assert.equal(seam.applyAdaptation({ stepId: 'extra-tiles', action: 'shed' }).ok, true);

  const failed = seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: false });

  assert.equal(failed.ok, false);
  assert.deepEqual(restored, ['extra-tiles']);
  assert.equal(seam.getSnapshot().promise.active, true);
  assert.equal(seam.getSnapshot().steps.find((step) => step.id === 'extra-tiles').currentlyShed, true);
  assert.equal(seam.getSnapshot().steps.find((step) => step.id === 'crowd').currentlyShed, true);
  assert.doesNotMatch(seam.inspect().summary, /full.fidelity/i);

  failExtraTiles = false;
  const retried = seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: false });

  assert.equal(retried.ok, true);
  assert.deepEqual(restored, ['extra-tiles', 'extra-tiles', 'crowd']);
  assert.equal(seam.getSnapshot().promise.active, false);
  assert.equal(seam.getSnapshot().steps.find((step) => step.id === 'extra-tiles').currentlyShed, false);
  assert.equal(seam.getSnapshot().steps.find((step) => step.id === 'crowd').currentlyShed, false);
  runtime.stop();
});

test('a failed manual restore never reports full fidelity without an active promise', () => {
  const env = sandbox();
  const runtime = runtimeIn(env, { restoreCrowd: () => { throw new Error('restore failed'); } });
  const seam = runtime.testSeam();
  assert.equal(seam.applyAdaptation({ stepId: 'crowd', action: 'shed' }).ok, true);
  observer(env, 'event').callback({ getEntries: () => [
    { name: 'click', interactionId: 1, duration: 20, startTime: 1000 }
  ] });

  const result = seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: false });

  assert.equal(result.ok, false);
  assert.match(result.summary, /cannot turn off until all cut steps are restored/i);
  assert.equal(seam.getSnapshot().promise, null);
  assert.equal(seam.getSnapshot().steps.find((step) => step.id === 'crowd').currentlyShed, true);
  assert.match(seam.inspect().summary, /restoration is pending/i);
  assert.doesNotMatch(seam.inspect().summary, /full.fidelity/i);
  runtime.stop();
});

test('contract inputs reject coercible strings instead of changing their meaning', () => {
  const env = sandbox();
  const runtime = runtimeIn(env);
  const seam = runtime.testSeam();
  assert.throws(() => seam.setSmoothnessContract({ maxInteractionLatencyMs: '100', protectedElement: 'always', active: true }), /integer/);
  assert.throws(() => seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: 'false' }), /boolean/);
  runtime.stop();
});

test('permanent and active-contract protection cannot report a false release', () => {
  const env = sandbox();
  const runtime = runtimeIn(env);
  const seam = runtime.testSeam();
  const permanent = seam.protectExperienceElement({ elementId: 'always', protect: false });
  assert.equal(permanent.ok, false);
  assert.match(permanent.summary, /permanently protected/i);
  seam.protectExperienceElement({ elementId: 'agent-protected', protect: true });
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'agent-protected', active: true });
  const contracted = seam.protectExperienceElement({ elementId: 'agent-protected', protect: false });
  assert.equal(contracted.ok, false);
  assert.match(contracted.summary, /backs the active promise/i);
  assert.ok(seam.getSnapshot().promise.protectedIds.includes('agent-protected'));
  runtime.stop();
});

test('a non-shedable step refuses manual cuts and is skipped by the controller', () => {
  const env = sandbox();
  const runtime = env.window.Loadshed.create({
    elements: [
      { id: 'always', label: 'Always protected', neverShed: true },
      { id: 'fixed', label: 'Fixed work' },
      { id: 'cuttable', label: 'Cuttable work' }
    ],
    ladder: [
      { id: 'fixed', label: 'Fixed work', order: 1, shedable: false, shed: () => {}, restore: () => {} },
      { id: 'cuttable', label: 'Cuttable work', order: 2, shed: () => {}, restore: () => {} }
    ],
    visiblePressureMs: 0,
    persistedPressureMs: 0
  }).start();
  const seam = runtime.testSeam();
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true });
  const manual = seam.applyAdaptation({ stepId: 'fixed', action: 'shed' });
  assert.equal(manual.ok, false);
  assert.match(manual.summary, /not shedable/i);
  assert.equal(seam.inspect().shed.nextAutomaticStepId, 'cuttable');
  assert.equal(Object.hasOwn(seam.inspect().shed, 'nextUnpinnedStepId'), false);
  seam.setBusyworkLevel(100);
  observer(env, 'longtask').callback({ getEntries: () => [
    { duration: 55, startTime: 1001 }, { duration: 55, startTime: 1002 }
  ] });
  assert.equal(seam.getSnapshot().steps.find((step) => step.id === 'fixed').currentlyShed, false);
  assert.equal(seam.getSnapshot().steps.find((step) => step.id === 'cuttable').currentlyShed, true);
  runtime.stop();
});

test('a manual cut starts the same dwell that guards automatic cuts', () => {
  const env = sandbox();
  const runtime = runtimeIn(env, { twoSteps: true, controller: { persistedPressureMs: 0 } });
  const seam = runtime.testSeam();
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true });
  seam.setBusyworkLevel(100);
  seam.applyAdaptation({ stepId: 'crowd', action: 'shed' });
  env.clock.now += 1;
  observer(env, 'longtask').callback({ getEntries: () => [
    { duration: 55, startTime: 1001 }, { duration: 55, startTime: 1001 }
  ] });
  assert.equal(seam.getSnapshot().steps.find((step) => step.id === 'extra-tiles').currentlyShed, false);
  runtime.stop();
});

test('the active promise refuses to pin its last measured-relief step', () => {
  const env = sandbox();
  const runtime = env.window.Loadshed.create({
    elements: [
      { id: 'always', label: 'Always protected', neverShed: true },
      { id: 'burn', label: 'Main-thread burn' },
      { id: 'visual', label: 'Visual motion' }
    ],
    ladder: [
      { id: 'burn', label: 'Main-thread burn', order: 1, shed: () => {}, restore: () => {} },
      { id: 'visual', label: 'Visual motion', order: 2, measuredRelief: false, shed: () => {}, restore: () => {} }
    ]
  }).start();
  const seam = runtime.testSeam();
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true });
  const result = seam.applyAdaptation({ stepId: 'burn', action: 'pin' });
  assert.equal(result.ok, false);
  assert.match(result.summary, /measured-relief step must remain/i);
  seam.applyAdaptation({ stepId: 'burn', action: 'shed' });
  const pinAfterCut = seam.applyAdaptation({ stepId: 'burn', action: 'pin' });
  assert.equal(pinAfterCut.ok, false);
  assert.match(pinAfterCut.summary, /measured-relief step must remain/i);
  runtime.stop();
});

test('the automatic controller leaves visual-only cuts for explicit agent choice', () => {
  const env = sandbox();
  const runtime = env.window.Loadshed.create({
    elements: [
      { id: 'always', label: 'Always protected', neverShed: true },
      { id: 'burn', label: 'Main-thread burn' },
      { id: 'visual', label: 'Visual motion' }
    ],
    ladder: [
      { id: 'burn', label: 'Main-thread burn', order: 1, shed: () => {}, restore: () => {} },
      { id: 'visual', label: 'Visual motion', order: 2, measuredRelief: false, shed: () => {}, restore: () => {} }
    ],
    visiblePressureMs: 0,
    persistedPressureMs: 0
  }).start();
  const seam = runtime.testSeam();
  seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true });
  seam.setBusyworkLevel(100);
  seam.applyAdaptation({ stepId: 'burn', action: 'shed' });
  env.clock.now += 900;
  observer(env, 'longtask').callback({ getEntries: () => [
    { duration: 55, startTime: 1900 }, { duration: 55, startTime: 1901 }
  ] });
  assert.equal(seam.getSnapshot().steps.find((step) => step.id === 'visual').currentlyShed, false);
  assert.equal(seam.adaptationOptions().ladder.find((step) => step.id === 'visual').measuredRelief, false);
  assert.equal(seam.inspect().shed.nextAutomaticStepId, null);
  assert.match(seam.inspect().summary, /No automatic cut remains/);
  runtime.stop();
});

test('adaptation options expose useful protectable non-ladder targets on both demos', () => {
  const env = sandbox();
  const runtime = runtimeIn(env);
  const target = runtime.testSeam().adaptationOptions().protectable.find((item) => item.id === 'agent-protected');
  assert.equal(target.id, 'agent-protected');
  assert.equal(target.label, 'Agent protected');
  assert.equal(target.protected, false);
  assert.match(rootDeskSource, /\{ id: 'mark-note', label: 'Mixer status' \}/);
  assert.match(saleSource, /\{ id: 'hold-note', label: 'Hold status' \}/);
  runtime.stop();
});

test('missing PerformanceObserver is reported and an unmeasurable active promise is refused', () => {
  const env = sandbox({ performanceObserver: false });
  const runtime = runtimeIn(env);
  const seam = runtime.testSeam();
  assert.equal(seam.getSnapshot().framePrimitive, 'none');
  assert.equal(seam.getSnapshot().interaction.diagnosis, 'unsupported');
  const result = seam.setSmoothnessContract({ maxInteractionLatencyMs: 100, protectedElement: 'always', active: true });
  assert.equal(result.ok, false);
  assert.match(result.summary, /frame-hitch signal/i);
  runtime.stop();
});

test('read-only tool inputs reject schema-invalid coercion', () => {
  const env = sandbox();
  const runtime = runtimeIn(env);
  const seam = runtime.testSeam();
  assert.throws(() => seam.inspect({ windowMs: '500' }), /integer/);
  assert.throws(() => seam.interventionReceipts({ limit: '2' }), /integer/);
  assert.throws(() => seam.interventionReceipts({ sinceIso: 0 }), /string/);
  runtime.stop();
});

test('every WebMCP input property explains itself to the agent', () => {
  const env = sandbox();
  const runtime = runtimeIn(env);
  for (const tool of runtime.testSeam().toolDefinitions()) {
    for (const [name, property] of Object.entries(tool.inputSchema.properties)) {
      assert.equal(typeof property.description, 'string', `${tool.name}.${name} needs a description`);
      assert.ok(property.description.length > 12, `${tool.name}.${name} description is too vague`);
    }
  }
  runtime.stop();
});

test('both demos render promise state from runtime snapshots and Sale uses the active ceiling', () => {
  for (const source of [rootDeskSource, saleSource]) {
    assert.match(source, /id="protected-value"/);
    assert.match(source, /ui\.promiseToggle\.checked = promise\.active/);
    assert.match(source, /ui\.ceiling\.textContent = `\$\{promise\.maxInteractionLatencyMs\} ms`/);
    assert.match(source, /syncPromiseUi\(state\.promise\)/);
  }
  assert.match(saleSource, /handlerDelayMs > holdState\.maxInteractionLatencyMs/);
});

test('the page routes wire the fallback on the requested controls', () => {
  assert.equal(rootDeskSource.match(/recordPageMeasuredClick\(event\)/g)?.length, 1, 'the root mixer owns its bubbling clicks once');
  assert.match(saleSource, /ui\.tap\.addEventListener\('click', \(event\) => \{\s*runtime\.recordPageMeasuredClick\(event\)/);
});

test('active demo surfaces honor reduced motion, preserve pressure, and expose no production test seam', () => {
  assert.match(rootDeskSource, /<h1 class="brand">Hold the Line<\/h1>/);
  assert.match(rootDeskSource, /if \(reduceMotion\) \{ tickOnce\(\); setInterval\(burnCrowd, 500\); \} else requestAnimationFrame\(frame\)/);
  assert.match(saleSource, /if \(reduceMotion\) \{ drawShimmer\(performance\.now\(\)\); setInterval\(burnAisle, 500\); \} else requestAnimationFrame\(frame\)/);
  assert.match(saleSource, /Math\.min\(8192, Math\.max\(1, Math\.round\(rect\.width \* ratio\)\)\)/);
  assert.match(saleSource, /Math\.min\(8192, Math\.max\(1, Math\.round\(rect\.height \* ratio\)\)\)/);
  for (const source of [rootDeskSource, saleSource]) {
    assert.match(source, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
    assert.doesNotMatch(source, /window\.__(?:holdTheLine|openStock)/);
  }
});

test('demo semantics and navigation identify the intended judge path', () => {
  assert.match(rootDeskSource, /firstElementChild\.matches\('p\.trust'\)/);
  assert.doesNotMatch(saleSource, /id="hold-size"[^>]*aria-pressed/);
  assert.doesNotMatch(saleSource, /ui\.hold\.setAttribute\('aria-pressed'/);
  assert.doesNotMatch(pickerSource, /tournament\/spike|development artifact/);
  for (const source of [rootDeskSource, saleSource]) assert.match(source, /tools skipped in iframe/);
});

test('demo initialization surfaces an unsupported promise instead of leaving it visibly on', () => {
  for (const source of [rootDeskSource, saleSource]) {
    assert.match(source, /const initialContract = runtime\.setContract/);
    assert.match(source, /if \(!initialContract\.ok\)/);
    assert.match(source, /ui\.promiseState\.textContent = 'unavailable'/);
  }
});
