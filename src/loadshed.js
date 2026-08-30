/*
 * Loadshed v0.1.0
 * A static-browser runtime for protecting declared page work by shedding only
 * registered, disposable work.  It deliberately has no DOM selectors: pages
 * provide stable IDs and the functions that enact each registered step.
 */
(function (global) {
  'use strict';

  const CALLERS = new Set(['webmcp-agent', 'page-control', 'test-seam']);
  const RECEIPT_KINDS = new Set(['contract', 'protect', 'shed', 'restore', 'measurement', 'override', 'refusal']);
  const CLICK_CLASS_EVENTS = new Set(['click', 'pointerdown', 'keydown']);
  const HISTORY_LIMITS = Object.freeze({ frames: 300, interactions: 200, receipts: 200 });
  const SHED_DWELL_MS = 900;
  const PAGE_MEASURED_FALLBACK_MS = 80;
  const INTERACTION_MATCH_WINDOW_MS = 8;
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const now = () => performance.now();
  const isoNow = () => new Date().toISOString();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const number = (value) => Number.isFinite(value) ? value : null;

  function rejectUnknown(input, allowed) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Input must be an object.');
    for (const key of Object.keys(input)) {
      if (!allowed.includes(key)) throw new TypeError(`Unknown input key: ${key}.`);
    }
  }

  function ensureCaller(caller) {
    if (!CALLERS.has(caller)) throw new TypeError('Caller must be webmcp-agent, page-control, or test-seam.');
    return caller;
  }

  function oneOf(value, choices, label) {
    if (!choices.includes(value)) throw new TypeError(`${label} must be one of: ${choices.join(', ')}.`);
    return value;
  }

  function plainError(error) {
    return error instanceof Error ? error.message : String(error);
  }

  class LoadshedRuntime {
    constructor(options) {
      if (!options || typeof options !== 'object') throw new TypeError('Loadshed needs page options.');
      const elements = Array.isArray(options.elements) ? options.elements : [];
      const ladder = Array.isArray(options.ladder) ? options.ladder : [];
      if (!elements.length || !ladder.length) throw new TypeError('Loadshed needs declared elements and a shed ladder.');

      this.options = options;
      this.elements = new Map();
      this.aliases = new Map(Object.entries(options.aliases || {}));
      this.steps = new Map();
      this.receipts = [];
      this.receiptSequence = 0;
      this.frames = [];
      this.interactions = [];
      this.rawEventCount = 0;
      this.untrustedRejectedCount = 0;
      this.pageMeasuredSequence = 0;
      this.pageMeasurementTimers = new Map();
      this.promise = null;
      this.framePrimitive = 'none';
      this.frameObserver = null;
      this.eventObserver = null;
      this.controllerTimer = null;
      this.toolAbortController = null;
      this.toolRegistrationHandles = [];
      this.toolRegistrationFallbackNames = [];
      this.toolModelContext = null;
      this.registrationAttempt = 0;
      this.pressure = 0;
      this.pressureSince = 0;
      this.cooldownSince = 0;
      this.shedAt = 0;
      this.started = false;
      this.registration = { surface: 'unavailable', status: 'pending', error: null, registeredTools: [] };
      this.controller = {
        hitchMs: Number.isFinite(options.hitchMs) ? options.hitchMs : 50,
        visiblePressureMs: Number.isFinite(options.visiblePressureMs) ? options.visiblePressureMs : 1400,
        persistedPressureMs: Number.isFinite(options.persistedPressureMs) ? options.persistedPressureMs : 1800,
        restoreMs: Number.isFinite(options.restoreMs) ? options.restoreMs : 700,
        pressureThreshold: Number.isFinite(options.pressureThreshold) ? options.pressureThreshold : 70,
        clearThreshold: Number.isFinite(options.clearThreshold) ? options.clearThreshold : 30
      };

      for (const entry of elements) {
        if (!entry || typeof entry.id !== 'string' || !entry.id || this.elements.has(entry.id)) {
          throw new TypeError('Every page element needs one unique, stable id.');
        }
        this.elements.set(entry.id, {
          id: entry.id,
          label: entry.label || entry.id,
          neverShed: Boolean(entry.neverShed),
          protectable: entry.protectable !== false,
          protected: Boolean(entry.neverShed),
          metadata: entry.metadata || null
        });
      }
      for (const [alias, target] of this.aliases) {
        if (!this.elements.has(target)) throw new TypeError(`Alias ${alias} resolves to an unknown page element.`);
      }
      for (const entry of ladder) {
        if (!entry || typeof entry.id !== 'string' || !entry.id || this.steps.has(entry.id)) {
          throw new TypeError('Every ladder step needs one unique id.');
        }
        const pageElement = this.elements.get(entry.id);
        if (!pageElement) {
          throw new TypeError(`Every shed step must use a declared page-owned element id: ${entry.id}.`);
        }
        if (pageElement.neverShed || entry.protected) {
          throw new TypeError(`A protected element cannot be a shed step: ${entry.id}.`);
        }
        this.steps.set(entry.id, {
          id: entry.id,
          label: entry.label || entry.id,
          cost: entry.cost || 'unknown',
          order: Number.isInteger(entry.order) ? entry.order : this.steps.size + 1,
          shedable: entry.shedable !== false,
          measuredRelief: entry.measuredRelief !== false,
          pinned: false,
          currentlyShed: false,
          from: typeof entry.from === 'string' && entry.from.trim() ? entry.from : 'full',
          to: typeof entry.to === 'string' && entry.to.trim() ? entry.to : 'reduced',
          shed: typeof entry.shed === 'function' ? entry.shed : () => {},
          restore: typeof entry.restore === 'function' ? entry.restore : () => {}
        });
      }
      this.orderedSteps = [...this.steps.values()].sort((a, b) => a.order - b.order);
      if (this.orderedSteps.some((step, index) => step.order !== index + 1)) {
        throw new TypeError('Shed-ladder orders must be consecutive, starting at 1.');
      }
    }

    resolveElementId(id) {
      const resolved = this.aliases.get(id) || id;
      if (!this.elements.has(resolved)) throw new TypeError(`Unknown page-owned element id: ${id}.`);
      return resolved;
    }

    protectedIds() {
      return [...this.elements.values()].filter((item) => item.protected).map((item) => item.id);
    }

    interactionSnapshot(interaction) {
      return {
        trust: interaction?.trust || 'awaiting',
        interactionId: interaction?.interactionId || 0,
        beforeMs: number(interaction?.beforeMs),
        afterMs: number(interaction?.afterMs),
        rawCount: this.rawEventCount,
        trustedCount: this.interactions.length,
        untrustedRejectedCount: this.untrustedRejectedCount,
        grouping: 'max-duration-per-interactionId'
      };
    }

    interactionReadout(interaction) {
      if (!interaction) return null;
      const pageMeasured = interaction.trust === 'page-measured';
      return {
        interactionId: interaction.interactionId,
        durationMs: interaction.duration,
        name: interaction.name,
        startTime: interaction.startTime,
        trust: interaction.trust || 'trusted-user',
        label: pageMeasured
          ? `your click - ${Math.round(interaction.duration)} ms (page-measured; the browser reports only clicks over 16 ms)`
          : null
      };
    }

    sameInteractionStart(left, right) {
      return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= INTERACTION_MATCH_WINDOW_MS;
    }

    interactionPrompt() {
      const prompt = typeof this.options.interactionPrompt === 'string' ? this.options.interactionPrompt.trim() : '';
      return prompt || 'Ask a person to click a page control for trusted timing evidence.';
    }

    interactionDiagnosis() {
      const supported = this.performanceEntryTypes().includes('event');
      if (!supported) return { support: 'unsupported', diagnosis: 'unsupported' };
      if (!this.interactions.length && this.rawEventCount) return { support: 'event', diagnosis: `0 trusted of ${this.rawEventCount} raw` };
      if (!this.interactions.length) return { support: 'event', diagnosis: 'awaiting your click' };
      return { support: 'event', diagnosis: 'ok' };
    }

    evidenceGaps() {
      const gaps = [];
      if (this.framePrimitive === 'none') gaps.push('This browser does not provide a supported frame-hitch signal.');
      const eventSupported = this.performanceEntryTypes().includes('event');
      if (!eventSupported) gaps.push('This browser does not provide trusted click timing.');
      if (eventSupported && !this.interactions.length) {
        gaps.push(this.rawEventCount
          ? `The agent cannot measure clicks on this surface; ${this.interactionPrompt()}`
          : this.interactionPrompt());
      }
      const lastShed = this.receipts.find((receipt) => receipt.kind === 'shed');
      if (lastShed?.interaction?.beforeMs === null) gaps.push('A trusted before-click sample was not captured for the last cut.');
      if (lastShed && lastShed.interaction?.afterMs === null) gaps.push('Ask for one trusted click after the last cut to complete the comparison.');
      return [...new Set(gaps)];
    }

    performanceEntryTypes() {
      return typeof PerformanceObserver === 'function' && Array.isArray(PerformanceObserver.supportedEntryTypes)
        ? PerformanceObserver.supportedEntryTypes
        : [];
    }

    addReceipt({ kind, summary, caller, frame = null, interaction = null, shed = null, protectedIds = this.protectedIds() }) {
      if (!RECEIPT_KINDS.has(kind)) throw new TypeError(`Unknown receipt kind: ${kind}.`);
      ensureCaller(caller);
      const receipt = {
        id: ++this.receiptSequence,
        atIso: isoNow(),
        kind,
        summary,
        caller,
        frame: frame ? { primitive: frame.primitive, ms: number(frame.ms) } : null,
        interaction: interaction ? this.interactionSnapshot(interaction) : null,
        shed: shed ? { from: shed.from, to: shed.to, stepId: shed.stepId } : null,
        protectedIds: [...protectedIds],
        evidenceGaps: []
      };
      this.receipts.unshift(receipt);
      if (this.receipts.length > HISTORY_LIMITS.receipts) this.receipts.length = HISTORY_LIMITS.receipts;
      receipt.evidenceGaps = this.evidenceGaps();
      this.options.onReceipt?.(clone(receipt));
      this.emitState();
      return receipt;
    }

    emitState() {
      this.options.onState?.(this.getSnapshot());
    }

    setBusyworkLevel(level, caller = 'page-control') {
      ensureCaller(caller);
      const value = Number(level);
      if (!Number.isFinite(value) || value < 0 || value > 100) throw new TypeError('Busywork level must be between 0 and 100.');
      if (value >= this.controller.pressureThreshold && this.pressure < this.controller.pressureThreshold) this.pressureSince = now();
      if (value < this.controller.pressureThreshold) this.pressureSince = 0;
      this.pressure = value;
      if (value > this.controller.clearThreshold) this.cooldownSince = 0;
      this.evaluateController();
      this.emitState();
      return this.pressure;
    }

    setContract(input, caller = 'page-control') {
      ensureCaller(caller);
      rejectUnknown(input, ['maxInteractionLatencyMs', 'protectedElement', 'active']);
      if (!own(input, 'maxInteractionLatencyMs') || !own(input, 'protectedElement')) {
        throw new TypeError('maxInteractionLatencyMs and protectedElement are required.');
      }
      const max = input.maxInteractionLatencyMs;
      if (!Number.isInteger(max) || max < 50 || max > 200) throw new TypeError('maxInteractionLatencyMs must be an integer from 50 to 200.');
      const protectedElement = this.resolveElementId(input.protectedElement);
      const protectedItem = this.elements.get(protectedElement);
      if (this.steps.has(protectedElement)) {
        return this.refusal(`${protectedItem.label} backs a shed-ladder step. Pin or remove the step instead.`, caller);
      }
      if (!protectedItem.neverShed && !protectedItem.protected) {
        throw new TypeError('The contract can protect only a declared never-shed or currently protected element.');
      }
      if (own(input, 'active') && typeof input.active !== 'boolean') throw new TypeError('active must be a boolean.');
      const active = own(input, 'active') ? input.active : true;
      if (active && this.started && this.framePrimitive === 'none') {
        return this.refusal('The promise cannot turn on because this browser provides no supported frame-hitch signal.', caller);
      }
      if (active && !this.nextAutomaticStep()) {
        return this.refusal('The promise cannot turn on without an available measured-relief step.', caller);
      }
      this.promise = { active, maxInteractionLatencyMs: max, protectedElement, protectedLabel: protectedItem.label, protectedIds: this.protectedIds(), setAtIso: isoNow(), caller };
      if (!active) this.restoreAll(caller);
      const receipt = this.addReceipt({
        kind: 'contract',
        summary: active
          ? `Promise on: clicks under ${max} ms; ${protectedItem.label} stays protected.`
          : `Promise off: full fidelity is held for the contrast. Receipts remain available.`,
        caller
      });
      if (!active) {
        const override = this.addReceipt({
          kind: 'override',
          summary: 'Full fidelity is being held by choice while the promise is off.',
          caller
        });
        return { ok: true, summary: override.summary, receiptId: override.id, promise: clone(this.promise), evidenceGaps: this.evidenceGaps() };
      }
      return { ok: true, summary: receipt.summary, receiptId: receipt.id, promise: clone(this.promise), evidenceGaps: this.evidenceGaps() };
    }

    protectElement(input, caller = 'page-control') {
      ensureCaller(caller);
      rejectUnknown(input, ['elementId', 'protect']);
      if (typeof input.elementId !== 'string' || typeof input.protect !== 'boolean') throw new TypeError('elementId and protect are required.');
      const id = this.resolveElementId(input.elementId);
      const element = this.elements.get(id);
      if (!element.protectable) return this.refusal(`${element.label} is not a protection target.`, caller);
      if (element.neverShed && !input.protect) return this.refusal(`${element.label} is permanently protected and cannot be released.`, caller);
      if (!input.protect && this.promise?.active && this.promise.protectedElement === id) return this.refusal(`${element.label} backs the active promise and cannot be released.`, caller);
      if (this.steps.has(id) && input.protect) return this.refusal(`${element.label} is busywork. Pin it instead of making it never-shed.`, caller);
      element.protected = input.protect || element.neverShed;
      if (this.promise) this.promise.protectedIds = this.protectedIds();
      const receipt = this.addReceipt({
        kind: 'protect',
        summary: input.protect ? `${element.label} is protected.` : `${element.label} was released.`,
        caller
      });
      return { ok: true, summary: receipt.summary, receiptId: receipt.id, protectedIds: this.protectedIds(), evidenceGaps: this.evidenceGaps() };
    }

    refusal(summary, caller) {
      const receipt = this.addReceipt({ kind: 'refusal', summary, caller });
      return { ok: false, summary, receiptId: receipt.id, evidenceGaps: this.evidenceGaps() };
    }

    applyAdaptation(input, caller = 'page-control') {
      ensureCaller(caller);
      rejectUnknown(input, ['stepId', 'action']);
      const step = this.steps.get(input.stepId);
      if (!step) throw new TypeError('Unknown shed-ladder step id.');
      oneOf(input.action, ['shed', 'restore', 'pin', 'unpin'], 'action');
      if (this.elements.get(step.id)?.protected) return this.refusal(`${step.label} is protected and cannot be changed as busywork.`, caller);
      if (input.action === 'shed' && !step.shedable) return this.refusal(`${step.label} is not shedable.`, caller);
      if (input.action === 'pin') {
        const available = this.orderedSteps.filter((item) => item.shedable && item.measuredRelief && !item.pinned);
        if (this.promise?.active && step.shedable && step.measuredRelief && available.length <= 1 && !step.pinned) {
          return this.refusal('At least one measured-relief step must remain available while the promise is active.', caller);
        }
        step.pinned = true;
        const receipt = this.addReceipt({ kind: 'override', summary: `${step.label} is pinned; the controller will skip it.`, caller });
        return { ok: true, summary: receipt.summary, receiptId: receipt.id, adaptation: this.stepSnapshot(step), evidenceGaps: this.evidenceGaps() };
      }
      if (input.action === 'unpin') {
        step.pinned = false;
        const receipt = this.addReceipt({ kind: 'override', summary: `${step.label} is released; the controller may use it again.`, caller });
        return { ok: true, summary: receipt.summary, receiptId: receipt.id, adaptation: this.stepSnapshot(step), evidenceGaps: this.evidenceGaps() };
      }
      return this.changeStep(step, input.action === 'shed', caller, true);
    }

    changeStep(step, shouldShed, caller, isOverride = false, trigger = null) {
      ensureCaller(caller);
      if (shouldShed && !step.shedable) return this.refusal(`${step.label} is not shedable.`, caller);
      if (shouldShed && step.pinned) return this.refusal(`${step.label} is pinned and cannot be cut.`, caller);
      if (step.currentlyShed === shouldShed) {
        return { ok: true, summary: `${step.label} is already ${shouldShed ? 'cut' : 'restored'}.`, receiptId: null, adaptation: this.stepSnapshot(step), evidenceGaps: this.evidenceGaps() };
      }
      try {
        (shouldShed ? step.shed : step.restore)();
      } catch (error) {
        return this.refusal(`${step.label} could not be ${shouldShed ? 'cut' : 'restored'}: ${plainError(error)}`, caller);
      }
      step.currentlyShed = shouldShed;
      if (shouldShed) this.shedAt = now();
      const from = shouldShed ? step.from : step.to;
      const to = shouldShed ? step.to : step.from;
      const kind = isOverride ? 'override' : shouldShed ? 'shed' : 'restore';
      const frame = trigger ? { primitive: this.framePrimitive, ms: trigger.worstFrameMs } : null;
      const interaction = trigger ? {
        trust: trigger.beforeInteractionMs === null ? 'before-sample-uncaptured' : (trigger.beforeInteractionTrust || 'trusted-user'),
        interactionId: trigger.beforeInteractionId || 0,
        beforeMs: trigger.beforeInteractionMs,
        afterMs: null
      } : null;
      const receipt = this.addReceipt({
        kind,
        summary: shouldShed && trigger?.postShedInteraction
          ? `${trigger.previousStepLabel || 'Previous'} cut did not clear the hitches; cutting ${step.label}. Your interaction ${trigger.postShedInteraction.interactionId} was ${Math.round(trigger.postShedInteraction.duration)} ms after the cut. ${this.primaryProtectedLabel()} untouched.`
          : !step.measuredRelief
          ? shouldShed
            ? `Cut ${step.label} - a visual cut; it does not move the measured budget.`
            : `Restored ${step.label} - a visual restore; it does not move the measured budget.`
          : shouldShed
            ? `Cut ${step.label} ${from} to ${to}. ${this.primaryProtectedLabel()} untouched.`
            : `Restored ${step.label} ${from} to ${to}. ${this.primaryProtectedLabel()} stayed protected.`,
        caller,
        frame,
        interaction,
        shed: { from, to, stepId: step.id }
      });
      return { ok: true, summary: receipt.summary, receiptId: receipt.id, adaptation: this.stepSnapshot(step), evidenceGaps: this.evidenceGaps() };
    }

    primaryProtectedLabel() {
      return this.elements.get(this.promise?.protectedElement || this.protectedIds()[0])?.label || 'Protected work';
    }

    stepSnapshot(step) {
      return { id: step.id, label: step.label, cost: step.cost, order: step.order, shedable: step.shedable, measuredRelief: step.measuredRelief, pinned: step.pinned, currentlyShed: step.currentlyShed };
    }

    nextAutomaticStep() {
      return this.orderedSteps.find((step) => step.shedable && step.measuredRelief && !step.currentlyShed && !step.pinned);
    }

    recent(items, milliseconds) {
      const timestamp = now();
      return items.filter((item) => timestamp - item.observedAt <= milliseconds);
    }

    latestShedReceipt() {
      return this.receipts.find((receipt) => receipt.kind === 'shed' && receipt.interaction);
    }

    observePerformance() {
      const supported = this.performanceEntryTypes();
      this.framePrimitive = supported.includes('long-animation-frame')
        ? 'long-animation-frame'
        : supported.includes('longtask') ? 'longtask' : 'none';
      if (this.framePrimitive !== 'none') {
        this.frameObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.frames.push({ duration: entry.duration, startTime: entry.startTime, observedAt: now() });
            if (this.frames.length > HISTORY_LIMITS.frames) this.frames.shift();
          }
          this.evaluateController();
          this.emitState();
        });
        this.frameObserver.observe({ type: this.framePrimitive, buffered: true });
      }
      if (supported.includes('event')) {
        this.eventObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) this.recordEventTiming(entry);
          this.evaluateController();
          this.emitState();
        });
        this.eventObserver.observe({ type: 'event', buffered: true, durationThreshold: 16 });
      }
      this.emitState();
    }

    recordEventTiming(entry) {
      if (!CLICK_CLASS_EVENTS.has(entry.name)) return;
      this.rawEventCount += 1;
      if (!entry.interactionId) {
        this.untrustedRejectedCount += 1;
        if (this.untrustedRejectedCount === 1) {
          this.addReceipt({
            kind: 'measurement',
            summary: 'Rejected injected click evidence (interaction id 0). Ask a person to click instead.',
            caller: 'page-control',
            interaction: { trust: 'untrusted-injected-rejected', interactionId: 0, beforeMs: null, afterMs: null }
          });
        }
        return;
      }
      const pageMeasuredIndex = this.interactions.findIndex((item) => item.trust === 'page-measured' && this.sameInteractionStart(item.startTime, entry.startTime));
      if (pageMeasuredIndex !== -1) this.interactions.splice(pageMeasuredIndex, 1);
      const existing = this.interactions.find((item) => item.interactionId === entry.interactionId);
      const item = existing || { interactionId: entry.interactionId, duration: entry.duration, name: entry.name, startTime: entry.startTime, observedAt: now(), trust: 'trusted-user' };
      item.duration = Math.max(item.duration, entry.duration);
      item.name = entry.name;
      item.startTime = Math.min(item.startTime, entry.startTime);
      item.observedAt = now();
      item.trust = 'trusted-user';
      if (!existing) {
        this.interactions.push(item);
        if (this.interactions.length > HISTORY_LIMITS.interactions) this.interactions.shift();
      }
      this.updateAfterMeasurement(item);
    }

    recordPageMeasuredClick(event) {
      if (!event || event.isTrusted !== true || !Number.isFinite(event.timeStamp)) return false;
      const startTime = Number(event.timeStamp);
      const duration = now() - startTime;
      if (!Number.isFinite(duration) || duration < 0) return false;
      if ([...this.pageMeasurementTimers.keys()].some((pendingStart) => this.sameInteractionStart(pendingStart, startTime))) return true;
      let timer = null;
      timer = setTimeout(() => {
        if (this.pageMeasurementTimers.get(startTime) !== timer) return;
        this.pageMeasurementTimers.delete(startTime);
        if (this.interactions.some((item) => item.trust === 'trusted-user' && this.sameInteractionStart(item.startTime, startTime))) return;
        const item = {
          interactionId: `page-measured-${++this.pageMeasuredSequence}`,
          duration,
          name: 'click',
          startTime,
          observedAt: now(),
          trust: 'page-measured'
        };
        this.interactions.push(item);
        if (this.interactions.length > HISTORY_LIMITS.interactions) this.interactions.shift();
        this.updateAfterMeasurement(item);
        this.evaluateController();
        this.emitState();
      }, PAGE_MEASURED_FALLBACK_MS);
      this.pageMeasurementTimers.set(startTime, timer);
      return true;
    }

    updateAfterMeasurement(interaction) {
      const shedReceipt = this.latestShedReceipt();
      if (!shedReceipt || interaction.startTime < this.shedAt) return;
      shedReceipt.interaction.afterMs = interaction.duration;
      shedReceipt.interaction.interactionId = interaction.interactionId;
      shedReceipt.interaction.trust = interaction.trust === 'page-measured'
        ? 'page-measured'
        : shedReceipt.interaction.beforeMs === null ? 'before-sample-uncaptured' : 'trusted-user';
      shedReceipt.evidenceGaps = this.evidenceGaps();
      const existing = this.receipts.find((receipt) => receipt.kind === 'measurement' && receipt.shedReceiptId === shedReceipt.id);
      const measuredLabel = interaction.trust === 'page-measured'
        ? ' (page-measured; the browser reports only clicks over 16 ms)'
        : '';
      const summary = shedReceipt.interaction.beforeMs === null
        ? `Your click after the cut: ${Math.round(interaction.duration)} ms${measuredLabel}. A trusted before-click was not captured.`
        : `Your click: ${Math.round(shedReceipt.interaction.beforeMs)} ms before, ${Math.round(interaction.duration)} ms after the cut${measuredLabel}.`;
      if (existing) {
        existing.summary = summary;
        existing.interaction = this.interactionSnapshot(shedReceipt.interaction);
        existing.evidenceGaps = this.evidenceGaps();
        this.options.onReceipt?.(clone(existing));
      } else {
        const receipt = this.addReceipt({
          kind: 'measurement', summary, caller: 'page-control',
          interaction: shedReceipt.interaction
        });
        receipt.shedReceiptId = shedReceipt.id;
      }
    }

    evaluateController() {
      if (!this.promise?.active) return;
      const cycleStart = Math.max(this.pressureSince || 0, this.shedAt || 0);
      const recentFrames = this.recent(this.frames, 3500).filter((item) => item.startTime > cycleStart);
      const hitches = recentFrames.filter((item) => item.duration >= this.controller.hitchMs);
      const interactionWindow = this.recent(this.interactions, 5000);
      const preShedInteractions = interactionWindow
        .filter((item) => item.startTime >= (this.pressureSince || 0) && (!this.shedAt || item.startTime < this.shedAt));
      const postShedInteractions = this.shedAt
        ? interactionWindow.filter((item) => item.startTime >= this.shedAt)
        : [];
      const worstInteraction = preShedInteractions.length ? preShedInteractions.reduce((max, item) => item.duration > max.duration ? item : max) : null;
      const worstPostShedInteraction = postShedInteractions.length ? postShedInteractions.reduce((max, item) => item.duration > max.duration ? item : max) : null;
      const pressureVisible = this.pressure >= this.controller.pressureThreshold && now() - this.pressureSince >= this.controller.visiblePressureMs;
      const pressurePersisted = this.pressure >= this.controller.pressureThreshold && now() - this.pressureSince >= this.controller.persistedPressureMs;
      const interactionBreach = Boolean(
        (worstInteraction && worstInteraction.duration > this.promise.maxInteractionLatencyMs)
        || (worstPostShedInteraction && worstPostShedInteraction.duration > this.promise.maxInteractionLatencyMs)
      );
      const next = this.nextAutomaticStep();
      const cutDwellElapsed = !this.shedAt || now() - this.shedAt >= SHED_DWELL_MS;
      if (next && cutDwellElapsed && pressureVisible && hitches.length >= 2 && (interactionBreach || pressurePersisted)) {
        this.changeStep(next, true, 'page-control', false, {
          worstFrameMs: recentFrames.length ? Math.max(...recentFrames.map((item) => item.duration)) : null,
          beforeInteractionMs: worstInteraction?.duration ?? null,
          beforeInteractionId: worstInteraction?.interactionId ?? 0,
          beforeInteractionTrust: worstInteraction?.trust || null,
          postShedInteraction: worstPostShedInteraction && worstPostShedInteraction.duration > this.promise.maxInteractionLatencyMs ? worstPostShedInteraction : null,
          previousStepLabel: this.orderedSteps.find((step) => step.currentlyShed)?.label || null
        });
      }
      if (this.orderedSteps.some((step) => step.currentlyShed) && this.pressure <= this.controller.clearThreshold) {
        if (!this.cooldownSince) this.cooldownSince = now();
        if (now() - this.cooldownSince >= this.controller.restoreMs) this.restoreAll();
      } else if (this.pressure > this.controller.clearThreshold) {
        this.cooldownSince = 0;
      }
    }

    restoreAll(caller = 'page-control') {
      for (const step of [...this.orderedSteps].reverse()) {
        if (step.currentlyShed) this.changeStep(step, false, caller);
      }
      this.cooldownSince = 0;
      this.shedAt = 0;
    }

    inspect(input = {}) {
      rejectUnknown(input, ['windowMs']);
      const windowMs = own(input, 'windowMs') ? input.windowMs : 5000;
      if (!Number.isInteger(windowMs) || windowMs < 500 || windowMs > 15000) throw new TypeError('windowMs must be an integer from 500 to 15000.');
      const frames = this.recent(this.frames, windowMs);
      const latest = frames.at(-1);
      const latestTrusted = this.interactions.at(-1);
      const interactionStatus = this.interactionDiagnosis();
      const next = this.nextAutomaticStep();
      const summary = interactionStatus.diagnosis.startsWith('0 trusted')
        ? `The agent cannot measure clicks on this surface. ${this.interactionPrompt()}`
        : this.promise?.active ? `Promise on. ${next ? `Next automatic cut: ${next.label}.` : 'No automatic cut remains.'}` : 'Promise off; full-fidelity contrast mode is active.';
      return {
        ok: true, summary, nowIso: isoNow(), promise: this.promise ? clone(this.promise) : null,
        frame: { primitive: this.framePrimitive, latestMs: latest ? latest.duration : null, worstMsInWindow: frames.length ? Math.max(...frames.map((item) => item.duration)) : null, hitchCount50ms: frames.filter((item) => item.duration >= this.controller.hitchMs).length },
        interaction: { ...interactionStatus, trustedCount: this.interactions.length, rawCount: this.rawEventCount, untrustedRejectedCount: this.untrustedRejectedCount, latestTrusted: this.interactionReadout(latestTrusted) },
        shed: { active: this.orderedSteps.some((step) => step.currentlyShed), nextAutomaticStepId: next?.id || null, pins: this.orderedSteps.filter((step) => step.pinned).map((step) => step.id) },
        busyworkLevelPct: this.pressure, busyworkSource: 'human-slider', evidenceGaps: this.evidenceGaps()
      };
    }

    adaptationOptions() {
      return {
        ok: true,
        summary: 'These are the page-declared protection targets and disposable steps. Protected work is excluded from the ladder.',
        protected: [...this.elements.values()].filter((item) => item.protected).map((item) => ({ id: item.id, label: item.label, neverShed: item.neverShed })),
        protectable: [...this.elements.values()].filter((item) => item.protectable && !item.neverShed && !this.steps.has(item.id)).map((item) => ({ id: item.id, label: item.label, protected: item.protected })),
        neverShed: [...this.elements.values()].filter((item) => item.neverShed).map((item) => item.id),
        ladder: this.orderedSteps.map((step) => this.stepSnapshot(step)),
        pressureControl: { id: this.options.pressureControlId || 'busywork', operator: 'human-only', note: 'Judges drag this. Agents cannot produce trusted click evidence.' },
        evidenceGaps: this.evidenceGaps()
      };
    }

    interventionReceipts(input = {}) {
      rejectUnknown(input, ['sinceIso', 'limit']);
      const limit = own(input, 'limit') ? input.limit : 20;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TypeError('limit must be an integer from 1 to 100.');
      let since = null;
      if (own(input, 'sinceIso')) {
        if (typeof input.sinceIso !== 'string') throw new TypeError('sinceIso must be an ISO date string.');
        since = Date.parse(input.sinceIso);
        if (Number.isNaN(since)) throw new TypeError('sinceIso must be an ISO date string.');
      }
      const receipts = this.receipts.slice(0, HISTORY_LIMITS.receipts)
        .filter((receipt) => !since || Date.parse(receipt.atIso) >= since)
        .slice(0, limit)
        .map(clone);
      return { ok: true, summary: receipts.length ? receipts[0].summary : 'No intervention receipts yet.', receipts, evidenceGaps: this.evidenceGaps() };
    }

    toolDefinition(name, description, schema, handler, readOnlyHint) {
      return { name, title: name.replaceAll('_', ' '), description, inputSchema: schema, annotations: { readOnlyHint }, execute: async (input) => {
        try { return handler(input, 'webmcp-agent'); }
        catch (error) { return { ok: false, summary: plainError(error), receiptId: null, evidenceGaps: this.evidenceGaps() }; }
      } };
    }

    toolDefinitions() {
      const integer = { type: 'integer' };
      return [
        this.toolDefinition('inspect_responsiveness', 'Inspect the page promise, real browser signals, and available cuts.', { type: 'object', properties: { windowMs: { ...integer, minimum: 500, maximum: 15000, description: 'Recent measurement window in milliseconds; defaults to 5000.' } }, additionalProperties: false }, (input) => this.inspect(input), true),
        this.toolDefinition('get_adaptation_options', 'List page-declared protected work, protection targets, and disposable steps.', { type: 'object', properties: {}, additionalProperties: false }, () => this.adaptationOptions(), true),
        this.toolDefinition('set_smoothness_contract', 'Set or turn off the page responsiveness promise.', { type: 'object', properties: { maxInteractionLatencyMs: { ...integer, minimum: 50, maximum: 200, description: 'Maximum acceptable click latency in milliseconds.' }, protectedElement: { type: 'string', description: 'Stable page-owned element ID that backs this promise.' }, active: { type: 'boolean', description: 'True to enforce the promise; false for full-fidelity contrast mode.' } }, required: ['maxInteractionLatencyMs', 'protectedElement'], additionalProperties: false }, (input, caller) => this.setContract(input, caller), false),
        this.toolDefinition('protect_experience_element', 'Protect or release one page-declared element.', { type: 'object', properties: { elementId: { type: 'string', description: 'Stable page-owned element ID to protect or release.' }, protect: { type: 'boolean', description: 'True to protect the element; false to release eligible protection.' } }, required: ['elementId', 'protect'], additionalProperties: false }, (input, caller) => this.protectElement(input, caller), false),
        this.toolDefinition('apply_adaptation', 'Pin, release, cut, or restore one declared busywork step.', { type: 'object', properties: { stepId: { type: 'string', description: 'Stable ID of one page-declared shed-ladder step.' }, action: { type: 'string', enum: ['shed', 'restore', 'pin', 'unpin'], description: 'Bounded action to apply to the declared step.' } }, required: ['stepId', 'action'], additionalProperties: false }, (input, caller) => this.applyAdaptation(input, caller), false),
        this.toolDefinition('get_intervention_receipts', 'Read the newest intervention receipts and any evidence gaps.', { type: 'object', properties: { sinceIso: { type: 'string', description: 'Optional ISO timestamp; return receipts at or after this time.' }, limit: { ...integer, minimum: 1, maximum: 100, description: 'Maximum newest-first receipts to return; defaults to 20.' } }, additionalProperties: false }, (input) => this.interventionReceipts(input), true)
      ];
    }

    cleanupToolRegistrations(handles, fallbackNames, modelContext) {
      for (const unregister of handles) {
        try { unregister(); } catch (error) { /* Best-effort cleanup for an optional browser surface. */ }
      }
      if (typeof modelContext?.unregisterTool === 'function') {
        for (const name of fallbackNames) {
          try { modelContext.unregisterTool(name); } catch (error) { /* Best-effort cleanup for an optional browser surface. */ }
        }
      }
    }

    async registerTools() {
      const attempt = ++this.registrationAttempt;
      if (window.parent !== window) {
        this.registration = { surface: 'iframe', status: 'skipped', error: 'Tools register only on the top-level document.', registeredTools: [] };
        this.addReceipt({ kind: 'measurement', summary: 'Tool registration skipped: this is an iframe; tools register only on the top-level page.', caller: 'page-control' });
        return clone(this.registration);
      }
      const modelContext = document.modelContext;
      if (!modelContext?.registerTool) {
        this.registration = { surface: 'unavailable', status: 'unsupported', error: 'document.modelContext is absent', registeredTools: [] };
        this.emitState();
        return clone(this.registration);
      }
      const registeredTools = [];
      const handles = this.toolRegistrationHandles = [];
      const fallbackNames = this.toolRegistrationFallbackNames = [];
      this.toolModelContext = modelContext;
      const abortController = typeof AbortController === 'function' ? new AbortController() : null;
      this.toolAbortController = abortController;
      try {
        for (const tool of this.toolDefinitions()) {
          const registration = abortController
            ? await modelContext.registerTool(tool, { signal: abortController.signal })
            : await modelContext.registerTool(tool);
          if (typeof registration === 'function') handles.push(registration);
          else if (typeof registration?.unregister === 'function') handles.push(() => registration.unregister());
          else fallbackNames.push(tool.name);
          registeredTools.push(tool.name);
          if (!this.started || attempt !== this.registrationAttempt) {
            this.cleanupToolRegistrations(handles.splice(0), fallbackNames.splice(0), modelContext);
            return clone(this.registration);
          }
        }
        this.registration = { surface: 'document.modelContext', status: 'registered', error: null, registeredTools };
      } catch (error) {
        this.cleanupToolRegistrations(handles.splice(0), fallbackNames.splice(0), modelContext);
        abortController?.abort();
        if (!this.started || attempt !== this.registrationAttempt) return clone(this.registration);
        this.toolModelContext = null;
        this.toolAbortController = null;
        this.registration = { surface: 'document.modelContext', status: 'error', error: plainError(error), registeredTools: [] };
      }
      this.emitState();
      return clone(this.registration);
    }

    start() {
      if (this.started) return this;
      this.started = true;
      this.registration = { surface: 'unavailable', status: 'pending', error: null, registeredTools: [] };
      this.observePerformance();
      this.controllerTimer = setInterval(() => {
        if (this.promise?.active) this.evaluateController();
      }, 350);
      this.registerTools();
      return this;
    }

    stop() {
      this.started = false;
      this.registrationAttempt += 1;
      this.frameObserver?.disconnect();
      this.eventObserver?.disconnect();
      if (this.controllerTimer !== null) clearInterval(this.controllerTimer);
      this.controllerTimer = null;
      for (const timer of this.pageMeasurementTimers.values()) clearTimeout(timer);
      this.pageMeasurementTimers.clear();
      this.toolAbortController?.abort();
      this.cleanupToolRegistrations(this.toolRegistrationHandles.splice(0), this.toolRegistrationFallbackNames.splice(0), this.toolModelContext);
      this.toolModelContext = null;
      this.toolAbortController = null;
      this.registration = { surface: this.registration.surface, status: 'stopped', error: null, registeredTools: [] };
      this.emitState();
    }

    getSnapshot() {
      const interactionStatus = this.interactionDiagnosis();
      const latestTrusted = this.interactions.at(-1);
      return clone({
        promise: this.promise, pressure: this.pressure, framePrimitive: this.framePrimitive,
        registration: this.registration, receipts: this.receipts.slice(0, HISTORY_LIMITS.receipts), steps: this.orderedSteps.map((step) => this.stepSnapshot(step)),
        interaction: { ...interactionStatus, rawCount: this.rawEventCount, trustedCount: this.interactions.length, untrustedRejectedCount: this.untrustedRejectedCount, latestTrusted: this.interactionReadout(latestTrusted) },
        evidenceGaps: this.evidenceGaps()
      });
    }

    testSeam() {
      return {
        getSnapshot: () => this.getSnapshot(),
        setSmoothnessContract: (input) => this.setContract(input, 'test-seam'),
        setBusyworkLevel: (level) => this.setBusyworkLevel(level, 'test-seam'),
        applyAdaptation: (input) => this.applyAdaptation(input, 'test-seam'),
        protectExperienceElement: (input) => this.protectElement(input, 'test-seam'),
        recordPageMeasuredClick: (event) => this.recordPageMeasuredClick(event),
        inspect: (input) => this.inspect(input),
        adaptationOptions: () => this.adaptationOptions(),
        interventionReceipts: (input) => this.interventionReceipts(input),
        toolDefinitions: () => this.toolDefinitions().map((tool) => ({ ...tool, execute: undefined }))
      };
    }
  }

  global.Loadshed = Object.freeze({
    version: '0.1.0',
    create(options) { return new LoadshedRuntime(options); }
  });
})(window);
