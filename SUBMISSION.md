# WebMCP Challenge submission handoff

This file tracks repository evidence, published artifacts, and close-out work that still requires
a supported WebMCP browser, video upload, or final submission authority.

## Current submission state

- Source tree and local tests — **READY — 34/34 Node tests pass.**
- Live URL — **DEPLOYED AND WEBMCP-QUALIFIED — <https://mcs-eng.github.io/loadshed/>.** Anonymous
  HTTPS checks, an Edge 152 smoke, and a live Codex in-app-browser WebMCP run passed on August 29,
  2026. A final confirmation in the rules-named ChatGPT in-app browser or Chrome 149+ remains.
- Public repository — **PUBLIC — <https://github.com/mcs-eng/loadshed>.** It contains only the
  allowlisted release history, and GitHub detects the root MIT license.
- YouTube video — **PENDING — operator must record narration, upload publicly, and provide the URL.**
- Devpost entry — **PUBLIC DRAFT — <https://devpost.com/software/loadshed>.** The judge-facing copy,
  live URL, public repository, and technology list are present. The video, required submission
  answers, explicit rules acknowledgment, and final submission are not complete.

Do not publish this private repository's Git history. Raw local agent transcripts were removed from
the current tree, but older private commits still contain them. The public repository was created
from the product-only export. Use the same exporter for future release staging:

```powershell
.\scripts\Export-PublicRelease.ps1 -Destination C:\path\to\loadshed-public
```

The exporter refuses a destination inside this repository or a nonempty destination, then copies
an explicit allowlist of product source, tests, license, and judge documentation. Internal build
orchestration and development artifacts are excluded. Sync only that staged output into the public
release, rerun its tests, and verify the release hashes before pushing.

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

Run this against <https://mcs-eng.github.io/loadshed/> in ChatGPT's in-app browser or Chrome 149+
with the WebMCP testing flag enabled. Keep the agent and person roles separate.

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

## Qualification receipt — August 29, 2026

This was a live WebMCP run against the deployed site, not a registration mock or endpoint probe.
The client was Codex's in-app browser. The qualified product release was public commit `93f8d1a`;
the Desk and Sale product files in that release are identical to private source commit `5adee9d`.

- **Discovery:** after visiting each page, the client discovered exactly six tools:
  `inspect_responsiveness`, `get_adaptation_options`, `set_smoothness_contract`,
  `protect_experience_element`, `apply_adaptation`, and `get_intervention_receipts`.
- **Desk:** the agent activated a 100 ms `live-trace` contract and protected the eligible
  `mark-note` target. At 100% person-controlled Crowd load, a `long-animation-frame` signal produced
  a measured automatic cut from Crowd 480 to 48. The cut receipt recorded a 320.157 ms frame and
  stated that Live trace was untouched. Structured inspection, visible state, and newest-first
  receipts agreed.
- **Sale:** the agent activated a 100 ms `hold-size` contract and protected `hold-note`. At 100%
  person-controlled Aisle load, the measured step changed aisle shimmer from 480 to 48 while Hold my
  size remained protected. The live frame signal was about 320.4 ms, and structured receipts agreed
  with the visible Sale state.
- **Safety and reversibility:** the Desk refused an attempt to pin its last measured-relief step
  while the promise was active. Both eligible non-ladder protection targets could be protected and
  released. Clearing pressure restored the cut, and turning each contract off restored full
  fidelity with an agent-stamped override receipt.
- **Honest boundary:** browser-controlled activation of Tap to measure did not create a trusted
  interaction sample. The runtime kept `rawCount` and `trustedCount` at zero and continued to ask
  for a person-supplied click; it did not invent before/after evidence.

Two credential-free full-page screenshots were captured during the live cuts. One shows the Desk's
agent contract, protected trace, 480-to-48 cut, agent receipts, and explicit request for a real click;
the other shows the equivalent Sale proof.

Remaining qualification work is deliberately narrow: repeat the run in one client named by the
official rules (ChatGPT's in-app browser or Chrome 149+), supply the physical click that the agent
cannot provide, and record the exact browser/version and before/after interaction evidence. The
Codex run proves the deployed six-tool loop and page behavior; it does not claim that final named-
client or human-interaction evidence.

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

- [x] Choose the public project name and repository owner.
- [x] Run the allowlisted public exporter, initialize a new repository from its output, and confirm
  only sanitized history is reachable.
- [x] Make `LICENSE` detectable in the repository About panel.
- [x] Choose a static host and deploy the exact reviewed source commit.
- [x] Complete a live hosted six-tool qualification and record its bounded receipt.
- [x] Capture screenshots without credentials, private data, browser profiles, or unrelated tabs.
- [ ] Repeat the qualification in ChatGPT's in-app browser or Chrome 149+ with a physical click.
- [ ] Record, edit, and publicly upload the narrated video; verify runtime is less than 3:00.
- [ ] Replace the remaining YouTube placeholder with the public video URL.
- [x] Publish and review the project description in the Devpost draft.
- [ ] Submit before September 3, 2026 at 1:00 PM Pacific, then preserve the submitted artifacts
  through judging.

Official requirements and browser setup: <https://webmcp.devpost.com/rules>.
