# Loadshed

Loadshed is plant equipment, not the recipe. A page tells it what must keep working and what can give way, so the page can keep its promise while the browser is busy. It leaves a plain receipt of what it changed.

It is a small browser script for static pages. Copy it beside a page, declare that page's own stable IDs and callbacks, then use the returned runtime. It has no framework, build step, network call, DOM selector, or page-specific ID built in.

```html
<script src="../src/loadshed.js"></script>
<script>
  const runtime = Loadshed.create({
    elements: [
      { id: 'my-primary-work', label: 'Primary work', neverShed: true },
      { id: 'my-control', label: 'Control', neverShed: true },
      { id: 'my-busywork', label: 'Busywork' }
    ],
    ladder: [
      {
        id: 'my-busywork', label: 'Busywork', cost: 'high', order: 1,
        from: 'full', to: 'reduced',
        shed: () => { /* reduce only disposable work */ },
        restore: () => { /* restore it */ }
      }
    ],
    pressureControlId: 'my-pressure-control',
    interactionPrompt: 'Ask a person to click Save for trusted timing evidence.',
    onReceipt: (receipt) => console.log(receipt),
    onState: (state) => console.log(state)
  }).start();

  const pressureControl = document.querySelector('#my-pressure-control');
  pressureControl.addEventListener('input', () => {
    runtime.setBusyworkLevel(Number(pressureControl.value), 'page-control');
  });

  runtime.setContract({
    maxInteractionLatencyMs: 100,
    protectedElement: 'my-primary-work',
    active: true
  }, 'page-control');
</script>
```

## What it watches and decides

The controller prefers Long Animation Frames and uses `longtask` only when Long Animation Frames are unavailable. It observes Event Timing entries at a 16 ms threshold, but treats only click-class entries (`click`, `pointerdown`, and `keydown`) with a non-zero `interactionId` as usable interaction evidence. ID 0 is counted as rejected injected input only for that same click class; hover, scroll, and other entries are ignored silently. A page may call `recordPageMeasuredClick(event)` from a wired control: after 80 ms with no matching Event Timing entry, a real (`isTrusted`) click becomes a separately labeled `page-measured` sample. This is page timing, not browser Event Timing: the visible label says `your click - 6 ms (page-measured; the browser reports only clicks over 16 ms)`.

With a promise on, the controller considers a cut when all of these are true:

- busywork is at least 70% for 1.4 seconds;
- it has seen at least two 50 ms hitches; and
- either a trusted interaction exceeds the declared ceiling, or pressure has persisted for 1.8 seconds.

After a cut, another automatic cut waits at least 900 ms and only sees hitches with a start time after that cut. A post-cut trusted interaction that still breaches the ceiling can justify the next cut; its receipt names the interaction. The original pre-cut interaction window remains the before/after pairing for the receipt. It restores shed work in reverse order after busywork stays at 30% or lower for 700 ms. Pages may override the pressure and restore constants at construction, but agents cannot change them through a tool.

While a promise is active, a 350 ms controller heartbeat re-evaluates those clocks even if no new observer entry arrives. It does not emit page state when nothing changed, and `.stop()` clears it.

The controller never changes a page object itself. A registered ladder step supplies the `shed` and `restore` functions. The page chooses what those functions do and is responsible for keeping protected work out of them. A shedable step that lacks either function is rejected when the runtime is created.

## Page API

`Loadshed.create(options)` returns a runtime. Call `.start()` once after creating it.

`options.elements` is an array of stable page-owned IDs:

```js
{ id, label, neverShed, protectable }
```

`neverShed` declares a permanent protection. Such IDs cannot also be ladder steps. `protectable` defaults to true. The optional `aliases` map lets a page keep a compatibility name outside the library, for example `{ 'old-chart': 'live-trace' }`.

`options.interactionPrompt` is optional plain text supplied by the page. It is used when Event Timing has no trusted interaction, so a reusable runtime does not inherit another page's control names.

`options.ladder` is an ordered array:

```js
{ id, label, cost, order, from, to, measuredRelief, shed, restore }
```

Orders must be consecutive and begin at 1. The runtime validates that a protected ID is not placed in this matrix. A step can be pinned and skipped, but while a promise is active the last remaining measured-relief step cannot be pinned, even after it has been cut: the attempted action is refused and receipted. Set `shedable: false` to describe a ladder item that is visible to inspection but can never be cut. `unpin` is an explicit release. Permanent protection is never releasable, and a dynamic protection cannot be released while it backs the active contract.

Set `measuredRelief: false` for a cosmetic reduction. Automatic control skips that step; an agent may still apply it explicitly, and the resulting receipt says that it is visual only and does not move the measured budget. Ladder snapshots expose `measuredRelief` so the agent can distinguish the two classes before acting.

Useful runtime methods are:

- `setContract({ maxInteractionLatencyMs, protectedElement, active }, caller)` turns the promise on or off. The ceiling is an integer from 50 to 200 ms. Its protected element may be declared `neverShed` or already protected through `protectElement`. A ladder-step target is refused with a receipt that tells the caller to pin or remove the step instead. `active: false` is contrast mode: it restores all shed work, preserves receipts, prevents automatic shedding, and writes an explicit override receipt for the human's full-fidelity choice. If any cut step fails to restore, turning the promise off is refused with a receipt; the promise stays on and the step stays cut. Turning the promise on, or renegotiating an active promise, requires at least one shedable measured-relief step that is not pinned; a step that is currently cut still counts, so a promise can be renegotiated mid-cut.
- `setBusyworkLevel(0..100, caller)` receives the page's human slider value. It does not synthesize input or move the slider.
- `protectElement({ elementId, protect }, caller)` protects or releases an allowed page element.
- `recordPageMeasuredClick(event)` is the page-only fast-click fallback. It rejects injected events, waits for Event Timing first, and never overwrites a matching trusted Event Timing sample.
- `applyAdaptation({ stepId, action }, caller)` accepts `shed`, `restore`, `pin`, and `unpin`.
- `inspect({ windowMs })`, `adaptationOptions()`, and `interventionReceipts({ sinceIso, limit })` are read-only snapshots. `sinceIso`, when given, must be an ISO 8601 date or date-time string.
- `testSeam()` returns a readout and explicitly stamped setters. It has no route into the performance observers.

Mutating API calls require one caller stamp: `webmcp-agent`, `page-control`, or `test-seam`.

## WebMCP tools

When `document.modelContext.registerTool` is present, `.start()` registers these six tools. Each `execute` returns its result object. Inputs reject unknown keys. Registration is top-level only: an iframe records that it was skipped, and `.stop()` aborts and unregisters the tools where the browser surface supports those hooks.

| Tool | Mode | Purpose |
| --- | --- | --- |
| `inspect_responsiveness` | read-only | Promise, browser signals, trust diagnosis, pins, and `nextAutomaticStepId`. `windowMs` is 500–15000 ms. |
| `get_adaptation_options` | read-only | Declared protected IDs, eligible protection targets, the validated ladder, and the human-only pressure control. |
| `set_smoothness_contract` | mutation | Sets the 50–200 ms ceiling, declared protected element, and optional `active` state. |
| `protect_experience_element` | mutation | Protects or releases one declared element. |
| `apply_adaptation` | mutation | Sheds, restores, pins, or unpins one declared ladder step. |
| `get_intervention_receipts` | read-only | Gets newest-first receipts, optionally since an ISO time and limited to 1–100. |

Tool registration is attempted only on `document.modelContext`, not `navigator.modelContext`. In browsers without this surface the library still works through page controls and records registration as unsupported.

An active promise also requires a supported frame-hitch signal. If the runtime has started and the browser exposes neither Long Animation Frames nor `longtask`, `setContract(... active: true)` returns a refusal instead of showing an unenforceable promise. A missing `PerformanceObserver` is handled as unsupported rather than throwing.

## Receipts and trust

Every mutation receipt has this shared shape:

```js
{
  id, atIso, kind, summary, caller,
  frame: { primitive, ms } | null,
  interaction: {
    trust, interactionId, beforeMs, afterMs,
    rawCount, trustedCount, untrustedRejectedCount,
    grouping: 'max-duration-per-interactionId'
  } | null,
  shed: { from, to, stepId } | null,
  protectedIds,
  evidenceGaps
}
```

Kinds are `contract`, `protect`, `shed`, `restore`, `measurement`, `override`, and `refusal`. Receipts are newest first. If a required sample is absent, `evidenceGaps` says so instead of inventing a before/after value. Multiple Event Timing entries for the same interaction use that interaction's maximum duration. Their timing is classified using the entry's `startTime` against the actual shed time, not when the observer callback happened. `page-measured` is a distinct trust label when Event Timing does not report a real click under its 16 ms floor; it is never presented as browser Event Timing. Before/after pairing uses one open comparison: an automatic cut opens it, the first trusted or page-measured click that starts after that cut fills `afterMs` and mints or updates one `measurement` receipt, and restoring that step closes it. A click after the restore pairs with nothing, and `evidenceGaps` says the comparison stayed incomplete. Manual cuts through `applyAdaptation` never open a comparison, because they have no controller-selected before sample.

Frames retain the newest 300 entries; trusted interactions and receipts retain the newest 200 each. Snapshot and receipt reads take their bounded slice before cloning.

## Honest scope

Loadshed protects one page's declared work. It cannot repair another tab, the operating system, the network, or browser work the page does not own. It does stay responsive by cutting the disposable work it owns while the machine is drowning, whatever caused that pressure.

It also does not claim a complete measurement loop merely because a browser exposes WebMCP and another browser exposes trusted timing. Keep those surfaces and receipts named separately. Ask a person for a real click when the trust filter reports no usable interaction; do not substitute agent-injected input.
