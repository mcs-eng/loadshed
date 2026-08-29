# WebMCP Challenge submission handoff

This file separates repository-ready evidence from external artifacts that require Mason's
accounts, browser session, voice, or final submission authority.

## Current submission state

- Source tree and local tests — READY FOR REVIEW.
- Live URL — **PENDING — operator must choose a host, deploy, and qualify that exact URL.**
- Public repository — **PENDING — operator must publish a sanitized-history repository and make the
  MIT license visible in the repository About panel.**
- YouTube video — **PENDING — operator must record narration, upload publicly, and provide the URL.**
- Devpost entry — **PENDING — operator must review the final copy and submit before the deadline.**

Do not publish the existing Git history unchanged. Raw local agent transcripts were removed from
the current tree, but older commits still contain them. Create a new public repository from the
product-only export instead:

```powershell
.\scripts\Export-PublicRelease.ps1 -Destination C:\path\to\loadshed-public
```

The exporter refuses a destination inside this repository or a nonempty destination, then copies
an explicit allowlist of product source, tests, license, and judge documentation. Internal build
orchestration and development artifacts are excluded. Initialize the new Git repository only from
that output. A history rewrite is also possible, but it is a separate destructive decision because
it changes every affected commit ID. Before publication, run the exported tests and confirm the
new repository contains no credentials and exposes the root `LICENSE`, `README.md`, and
`SUBMISSION.md`.

## Draft project description

Loadshed gives a web page and an agent a shared, enforceable language for graceful degradation.
Instead of an agent guessing which DOM elements are safe to remove when a page becomes sluggish,
the page publishes a contract: the work that must remain useful, a strict interaction ceiling, and
an ordered ladder of disposable work. The person controls the synthetic pressure and supplies the
trusted click; the agent can inspect, negotiate, protect, adapt, and audit through six WebMCP tools.

That division is the WebMCP fit. Ordinary browser automation can click controls, but it cannot know
the page owner's intent or produce trustworthy latency evidence by clicking on its own behalf.
Loadshed exposes intent as structured tools and preserves the human's role in the measurement. The
result is a better experience because cuts are bounded, reversible, visible, and receipted rather
than inferred from brittle selectors.

The reusable `src/loadshed.js` runtime registers six tools with
`document.modelContext.registerTool`: `inspect_responsiveness`, `get_adaptation_options`,
`set_smoothness_contract`, `protect_experience_element`, `apply_adaptation`, and
`get_intervention_receipts`. It observes browser frame and interaction signals, rejects injected
click evidence, applies only page-registered callbacks, and fails closed when the browser cannot
support an honest promise. The Desk and Sale pages demonstrate the same engine protecting different
page-owned outcomes.

## Hosted qualification

Run this against the exact deployed URL in ChatGPT's in-app browser or Chrome 149+ with the WebMCP
testing flag enabled. Keep the agent and person roles separate.

1. Open the root URL and confirm **tools ready**.
2. Agent: call `inspect_responsiveness`; confirm promise, frame primitive, interaction diagnosis,
   and evidence gaps are objects rather than prose-only output.
3. Agent: call `get_adaptation_options`; confirm protected IDs and three ordered Desk steps.
4. Agent: call `set_smoothness_contract` for `live-trace` at 100 ms; confirm the visible card,
   checkbox, agent marker, and receipt match.
5. Person: move Crowd load above 70%, click Tap, and wait for a cut. Confirm the trace and mixer
   remain usable and the receipt names the cut without inventing missing evidence.
6. Agent: call `get_intervention_receipts`; compare its newest receipt with the visible rail.
7. Agent: call `apply_adaptation` to pin/unpin or restore a declared step, then intentionally try an
   invalid protected target and confirm a visible refusal receipt.
8. Agent: protect and release `mark-note` on Desk or `hold-note` on Sale. Confirm the visible
   receipt and the next `get_adaptation_options` response agree.
9. Open Sale at the same origin and repeat the contract plus a real Hold my size interaction.
10. Turn the promise off and confirm reverse-order restoration and an override receipt.

Record the deployed URL, browser/version, date, six-tool count, exact source commit, and any evidence
gap. Endpoint compatibility alone is not a qualification result.

## Video plan (target 2:30)

The final public YouTube video must be less than three minutes, include audio, show the project
functioning, and explain how it uses WebMCP. Use no copyrighted music or unlicensed third-party
material.

- **0:00–0:20 — Problem.** “A busy page knows what matters, but an agent usually does not. Loadshed
  lets the page publish the promise and the safe cut order.” Show the full Desk at idle.
- **0:20–0:45 — WebMCP surface.** Ask the agent to inspect responsiveness and adaptation options.
  Show the structured tool calls and the six-tool surface.
- **0:45–1:15 — Shared contract.** Ask the agent to set the 100 ms `live-trace` contract. Show the
  agent marker, synchronized promise card, and agent-stamped receipt.
- **1:15–1:50 — Human evidence and cut.** Drag Crowd load, click Tap yourself, and show the first
  cut plus its trust line. State that agent-injected clicks are rejected.
- **1:50–2:10 — Reversibility.** Read receipts with the agent, turn the promise off, and show full
  fidelity restore.
- **2:10–2:30 — Portability and impact.** Open Sale briefly. “Same plant equipment, different
  recipe: the page owns the protected work and the callbacks; Loadshed owns the contract.”

## Operator close-out checklist

- [ ] Choose the public project name and repository owner.
- [ ] Run the allowlisted public exporter, initialize a new repository from its output, and confirm
  only sanitized history is reachable.
- [ ] Make `LICENSE` detectable in the repository About panel.
- [ ] Choose a static host and deploy the exact reviewed source commit.
- [ ] Complete the hosted qualification above and record its receipt.
- [ ] Capture screenshots without credentials, private data, browser profiles, or unrelated tabs.
- [ ] Record, edit, and publicly upload the narrated video; verify runtime is less than 3:00.
- [ ] Replace the three PENDING URL fields with the real live, repository, and YouTube URLs.
- [ ] Paste and review the project description in Devpost.
- [ ] Submit before September 3, 2026 at 1:00 PM Pacific, then preserve the submitted artifacts
  through judging.

Official requirements and browser setup: <https://webmcp.devpost.com/rules>.
