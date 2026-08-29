# Loadshed: Hold the Line

Loadshed lets a web page make a responsiveness promise to a person and expose that promise to an
agent through WebMCP. The page declares what must stay useful, what work is disposable, and the
order in which that disposable work may be reduced. Every contract, cut, restore, refusal, and
measurement leaves a plain-language receipt.

The flagship demo is the site root: **Hold the Line**, a live-show desk that protects its trace and
controls while synthetic crowd work loads the main thread. The [Sale demo](sale/) proves that the
same runtime can protect a different page-owned task without learning that page's DOM. The
[floor picker](picker/) routes judges only to the Desk and Sale product surfaces.

## Judge walkthrough

Use either ChatGPT's in-app browser, which supports WebMCP by default, or Google Chrome 149+ with
`chrome://flags/#enable-webmcp-testing` enabled and the browser restarted. This is the setup named
in the [official challenge rules](https://webmcp.devpost.com/rules).

1. Open the live site root. The top-right badge should change to **tools ready**.
2. Ask the agent: “Inspect this page's responsiveness and list its adaptation options.” The agent
   can call `inspect_responsiveness` and `get_adaptation_options` without changing the page.
3. Ask the agent: “Set a 100 ms smoothness contract that protects `live-trace`.” The promise card,
   checkbox, protected label, agent marker, and receipt rail should agree with the tool result.
4. As the person, drag **Crowd load** toward **too much** and click **Tap to measure**. Agent-made
   input is intentionally not accepted as trusted latency evidence.
5. Watch Loadshed cut registered busywork in order while leaving the live trace and mixer useful.
   Read the receipt for its frame signal, click evidence, caller, and any evidence gap.
6. Turn the promise off to restore full fidelity, then repeat on [Sale](sale/) to see the same six
   tools protect **Hold my size** under a page-specific 100 ms handler cutoff.

If the badge says **tools unavailable**, the page controls and receipts still work, but that browser
does not expose `document.modelContext` and cannot demonstrate the agent half of the entry. If the
browser has no supported frame-hitch signal, the runtime refuses to present an active promise.

## Run locally

There is no build step, package install, framework, CDN, or network dependency. Serve the repository
over HTTP so the browser loads it as a site rather than a local file.

Windows PowerShell:

```powershell
py -m http.server 8080
```

Then open <http://localhost:8080/> in a supported WebMCP browser. Stop the server with `Ctrl+C`.

Run all repository tests from the repository root:

```powershell
node --test test\*.test.js
```

## What WebMCP exposes

`src/loadshed.js` registers six imperative tools on the top-level document:

| Tool | Changes state | Purpose |
| --- | --- | --- |
| `inspect_responsiveness` | No | Read the promise, signals, pressure, trust diagnosis, pins, and next automatic cut. |
| `get_adaptation_options` | No | List protected work, eligible protection targets, and the validated shed ladder. |
| `set_smoothness_contract` | Yes | Set a strict 50–200 ms ceiling, protected element, and active state. |
| `protect_experience_element` | Yes | Protect or release an eligible declared element. |
| `apply_adaptation` | Yes | Shed, restore, pin, or unpin one declared busywork step. |
| `get_intervention_receipts` | No | Read newest-first intervention receipts and evidence gaps. |

Inputs reject unknown keys and type coercion. The runtime refuses to cut pinned, protected, or
`shedable: false` work. Permanent protection cannot be released, and the exact element backing an
active contract cannot be released until the contract is off or moved. Tool registration is
top-level only, abortable, and cleaned up on partial failure or stop.

See the [runtime reference](src/loadshed-README.md) for the page API, controller thresholds,
receipt schema, trust model, and copy-paste integration example.

## Architecture

| Path | Role |
| --- | --- |
| [`src/loadshed.js`](src/loadshed.js) | Reusable, page-agnostic controller and WebMCP tool surface. |
| [`index.html`](index.html) | Canonical Hold the Line judge demo. |
| [`sale/index.html`](sale/index.html) | Second skin and real handler-lateness example. |
| [`src/sale-lateness.js`](src/sale-lateness.js) | Small pure helper for event-to-handler delay. |
| [`test/`](test/) | Node tests for controller, trust, lifecycle, demo wiring, and release hygiene. |
| [`scripts/Export-PublicRelease.ps1`](scripts/Export-PublicRelease.ps1) | Creates a product-only public release from an explicit allowlist. |
| [`SUBMISSION.md`](SUBMISSION.md) | Draft Devpost copy, video plan, qualification steps, and external boundaries. |

The demos use deliberate synthetic main-thread work so the cut is visible on one machine. That is
not a benchmark and does not claim to diagnose another tab, the operating system, the network, or
work the page does not own. Event Timing with a non-zero interaction ID is the preferred click
signal. Fast real clicks below Event Timing's reporting floor receive the distinct label
`page-measured`; injected clicks are rejected.

## Hackathon provenance and license

This project began on August 26, 2026, after the WebMCP Challenge submission period opened on
August 25. The local commit history records the spike, product selection, two demo skins, review
fixes, and release hardening. Internal development evidence stays outside the public export; the
root Desk is the intentional product surface.

The code is licensed under the [MIT License](LICENSE). Submission URLs and operator-owned artifacts
are tracked honestly in [SUBMISSION.md](SUBMISSION.md); placeholders are not presented as complete.
