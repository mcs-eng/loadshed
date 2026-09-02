# WebMCP Challenge submission handoff

This file tracks repository evidence, published artifacts, and close-out work that still requires
a supported WebMCP browser, video upload, or final submission authority.

## Current submission state

- Source tree and local tests — **READY — 49/49 Node tests pass.**
- Live URL — **DEPLOYED AND WEBMCP-QUALIFIED — <https://mcs-eng.github.io/loadshed/>.** Anonymous
  HTTPS checks, an Edge 152 smoke, and a live Codex in-app-browser WebMCP run passed on August 29,
  2026. The rules-named confirmation was completed on September 1, 2026 in ChatGPT's in-app browser against public commit `74c13a8`; see the September 1 receipt below.
- Public repository — **PUBLIC — <https://github.com/mcs-eng/loadshed>.** It contains only the
  allowlisted release history, and GitHub detects the root MIT license.
- YouTube video — **PENDING — operator must record narration, upload publicly, and provide the URL.**
- Devpost entry — **PUBLIC DRAFT — <https://devpost.com/software/loadshed>.** The judge-facing copy,
  live URL, public repository, technology list, and proof thumbnail are present. Registration is
  confirmed. The video, required submission answers, and final submission are not complete.

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

When a live control room or shopping flow gets slow, the page knows which human task must survive;
an agent looking at the DOM does not. Loadshed lets the page publish that priority as a contract: the
work that must remain useful, a strict interaction ceiling, and an ordered ladder of disposable
work. In the deployed Desk, a measured 320 ms long frame caused the registered Crowd workload to
drop from 480 to 48 while the live trace and mixer stayed useful, and the page showed a receipt for
the cut. The person controls pressure and supplies the trusted click; the agent can inspect,
negotiate, protect, adapt, and audit through six WebMCP tools.

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

## Devpost required answers (drafted 2026-09-01)

The rules ask four things of the text description. Paste each answer under its prompt on the form; every figure below comes from the September 1 receipt.

**Why is this use case a strong fit for WebMCP?**
A page under load knows which human task must survive; an agent reading the DOM does not. Loadshed lets the page publish that priority as six WebMCP tools registered with `document.modelContext.registerTool`: a smoothness contract, a protected element, an ordered ladder of disposable work, and receipts for every cut and refusal. The agent negotiates against the page's own contract instead of guessing from selectors.

**How does it create a better user experience?**
Cuts are bounded, ordered, reversible, and visible. On the deployed Desk, a measured 334.6 ms long frame cut Crowd from 480 to 48 while the live trace and mixer stayed usable, and the page-measured interaction went from 205.3 ms before the cut to 0.9 ms after. The person keeps the pressure controls and the trusted click; the agent can inspect, negotiate, protect, adapt, and audit without ever inventing evidence.

**What can people and agents do together that was difficult or impossible before?**
An agent can set a 100 ms promise for a named element and protect a second target, then read structured receipts that agree with what the person sees. The person supplies the physical click that makes latency evidence trustworthy; the runtime rejects agent-injected clicks and says so. Neither side could do this alone: the agent cannot produce trusted interaction evidence, and the person cannot read frame timing.

**Briefly explain how you implemented WebMCP.**
`src/loadshed.js` is one reusable runtime. It registers `inspect_responsiveness`, `get_adaptation_options`, `set_smoothness_contract`, `protect_experience_element`, `apply_adaptation`, and `get_intervention_receipts`, observes `long-animation-frame` and interaction timing, applies only page-registered callbacks in declared order, and fails closed when the browser cannot support an honest promise. The Desk and Sale pages prove the same engine protecting different page-owned outcomes with no knowledge of each other's DOM. 49 Node tests cover the runtime; the live site runs public commit `e031503`.

## Thursday pre-submit checklist

Submissions close Thursday, September 3, 2026 at 1:00 PM Pacific, 4:00 PM Eastern. Do these in order on Wednesday evening and Thursday morning.

1. Record the video from the recording sheet in one clean browser window. Confirm the runtime is under 3:00 and the audio names WebMCP and what was built.
2. Upload it to YouTube as public. Open the link in a private window to confirm it plays without sign-in.
3. Open <https://mcs-eng.github.io/loadshed/> in ChatGPT's in-app browser one more time and confirm the badge reads **tools ready**. Record the date and client in the tested-clients row.
4. On the Devpost form, paste the four answers above, the live URL, and the public repository URL <https://github.com/mcs-eng/loadshed>. Replace the YouTube placeholder with the real URL.
5. Confirm the public repository still shows the MIT license in the About panel and that tag `v0.1.0-submission` still points at `e031503`.
6. Read the whole form once as a judge would. Then submit before 4:00 PM Eastern, not at it.
7. Keep the confirmation page as a PDF outside this public repository and note the submission time in the private clone.

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

Two credential-free full-page screenshots were captured during the live cuts. The public
[Desk proof](assets/loadshed-live-proof.jpg) shows the agent contract, protected trace, 480-to-48
cut, agent receipts, and explicit request for a real click; the other shows the equivalent Sale
proof. The same Desk frame is the Devpost proof thumbnail.

Remaining qualification work is deliberately narrow: repeat the run in one client named by the
official rules (ChatGPT's in-app browser or Chrome 149+), supply the physical click that the agent
cannot provide, and record the exact browser/version and before/after interaction evidence. The
Codex run proves the deployed six-tool loop and page behavior; it does not claim that final named-
client or human-interaction evidence.

## Qualification receipt — September 1, 2026 (rules-named client)

Mason ran the full hosted checklist in ChatGPT's in-app browser (kept current by Mason; the
app surfaced no explicit version string on September 1, 2026) against the deployed site. GitHub Pages served exact public commit
`74c13a80d28e69618a68c76ffb53dc8f9f2e9486` (raw-vs-live byte comparison of `src/loadshed.js`
returned MATCH: True). Both pages discovered all six tools ("tools ready" on each). All
timestamps below are the ISO instants from the structured tool results.

- **Desk, first pass:** agent-set 100 ms `live-trace` contract at 11:22:15Z (caller
  `webmcp-agent`, receipt 2, visible "contract · agent" rail entry matched). Person raised
  Crowd above 70% and physically clicked Tap; automatic shed at 11:23:15Z cut Crowd 480 to 48
  with Live trace untouched. The 11:23:18Z measurement honestly reported the click landed
  after the cut and that no trusted before-click was captured.
- **Sale:** the runtime rejected injected click evidence (interaction id 0) at 11:24:56Z and
  asked for a person instead. Agent-set 100 ms `hold-size` contract at 11:28:45Z (receipt 3).
  Person set Aisle load to 100%, held the 8-inch size with a physical click; shed at 11:30:17Z
  cut aisle shimmer full to hush with Hold my size untouched, and the card showed
  "Aisle shimmer hush: 480 -> 48". Person turned the promise off; the 11:31:04Z restore,
  override, and contract-off receipts recorded full fidelity held by choice.
- **Desk, second pass (fresh load):** agent contract 11:32:27Z plus agent `mark-note`
  protection 11:32:29Z. Person cut at 11:33:29Z carried frame evidence
  (`long-animation-frame`, 334.6 ms), the 480-to-48 shed, and trusted page-measured
  before/after clicks of 205.3 ms and 0.9 ms — the before/after interaction evidence the
  August 29 run could not capture. The pin attempt on the last measured-relief step was
  refused (`ok: false`, receipt 6). Protecting unknown id `fake-widget` was refused with
  `ok: false` and `receiptId: null` — input validation rejections change nothing and mint no
  receipt; the state-touching refusal did. `mark-note` protected and released cleanly
  (receipts 3, 7, 8). `get_intervention_receipts` returned the complete coherent chain,
  ids 1 through 8, matching the visible rail. Promise off at 11:43:14Z restored Crowd 48 to
  480 with Live trace stayed, plus override and contract-off receipts, and a second
  injected-click rejection was recorded on Desk.

Screenshots of every key state were captured during the run. Evidence boundary: the first
Desk pass's physical click landed after its cut and was labeled as such; the second pass
captured the full trusted before/after pair.

Known non-blocking gap found during the run: the Sale page contains no navigation link back
to the picker or Desk (zero `href`s in its HTML) — a judge who enters Sale must use the
browser back button or type the URL. Navigation-only; no WebMCP defect.

Provenance note: the public repository advanced past the private clone on August 30–31 with
three fixes (partial-registration cleanup, incomplete-restoration refusal, and
stop-reverse-restoration-after-failure via public PR #3). The deployed public head is the
product of record for this receipt. On September 1 the private clone's `src/`, `test/`,
`index.html`, and `sale/index.html` were re-synced byte-for-byte from public `e031503`
(`git diff --stat HEAD loadshed/main -- index.html sale/ src/ test/ README.md` is empty).

## Post-merge live smoke — September 1, 2026 (public `e031503`)

Public PR #5 merged as `e031503` with the receipt-honesty fixes from the September 1
adversarial audit (post-restore click attribution, callback isolation, required ladder
callbacks, previous-cut label, `restoreAll` caller check, strict `sinceIso`, honest toggle
revert). Pages served the new runtime within minutes: `curl` of the live `src/loadshed.js`
returned HTTP 200 and contained the new `openComparison` field six times.

The README judge path was then walked on the live root in an automated browser that has no
WebMCP surface (badge read **tools unavailable**), so this smoke covers the page half only:

- Promise on at 20:12:04Z (page default). Crowd load set to 100%; automatic shed at
  20:12:53Z cut Crowd 480 to 48 with a 320 ms last hitch and Live trace untouched.
- A Tap after the cut produced one measurement receipt at 20:13:05Z pairing a before and
  after click, both labeled `page-measured` because the automated clicks fell under Event
  Timing's 16 ms floor.
- Promise off at 20:13:19Z: restore (Crowd 48 to 480), contract-off, and override receipts
  in order; the page read "Promise is off for contrast" and "Crowd at full fidelity".
- Two further Taps after the restore added **no** new measurement receipt and did **not**
  rewrite the 20:13:05Z receipt. The rail ended at six events. This is the defect the audit
  rated highest, now absent on the deployed product.

Evidence boundary: automated clicks are not physical clicks and this browser is not a
rules-named client. The September 1 qualification receipt above remains the named-client
evidence; its commit `74c13a8` predates the `e031503` fixes, so a final named-client pass
against `e031503` is still the strongest available close-out step.

## Video plan (target 1:30)

The final public YouTube video must be less than three minutes, include audio, show the project
functioning, and explain how it uses WebMCP. Use no copyrighted music or unlicensed third-party
material.

- **0:00–0:08 — Show the win first.** Label this beat **result**, then begin on the pressured Desk
  with **agent promise active**, Crowd reduced 480 to 48, Live trace still moving, and the newest
  receipt visible. “Here is the result: this page got slow, and the agent knew exactly what it could
  cut—and what it had to protect.”
- **0:08–0:20 — State the problem.** Restore to idle. “DOM automation can click things, but it
  cannot safely infer a page owner's performance priorities. Loadshed publishes those priorities as
  a WebMCP contract.”
- **0:20–0:35 — Expose intent.** Show the client discovering six tools, then ask: “Inspect this
  page's responsiveness and list its adaptation options.” Briefly show the structured promise,
  protected IDs, next measured cut, and evidence gap.
- **0:35–0:50 — Negotiate.** Ask: “Set a 100 millisecond contract for `live-trace`, then protect
  `mark-note`.” Show the agent marker, synchronized card, and two agent-stamped receipts. “The agent
  acts through page-owned IDs and callbacks, never guessed selectors.”
- **0:50–1:08 — Person supplies evidence.** Drag Crowd load to 100 and click Tap yourself. Hold on
  the 480-to-48 cut and trusted timing line. “The person supplies the click. Loadshed rejects
  injected ID-zero evidence and records any gap instead of inventing a win.”
- **1:08–1:20 — Audit and reverse.** Ask for intervention receipts, then turn the promise off.
  Show full fidelity restore. “Every cut, refusal, restore, and override is visible and reversible.”
- **1:20–1:30 — Prove portability.** Flash Sale with its **Hold my size** promise. “Same six tools,
  different page-owned priorities. Loadshed is a small runtime for human-agent responsiveness
  contracts on the open web.” End on the live URL and public repository.

Recording notes: use one continuous browser window at 1080p, enlarge the agent tool-result panel
enough to read the tool names, keep the page and receipt rail visible, and rehearse once so the first
working cut appears inside eight seconds. Do not show credentials, unrelated tabs, browser profiles,
or internal repositories. Verify the uploaded YouTube video is public, has audible narration, and
runs under 3:00 before adding its URL to Devpost.

### Teleprompter narration

This is the word-for-word target for a roughly 90-second cut. The bracketed cues are not spoken.

**[Result — pressured Desk]** “Here is the result. This page got slow, and the agent knew exactly
what it could cut—and what it had to protect.”

**[Restore to idle]** “A live control room or shopping flow knows which human task must survive.
DOM automation does not. Loadshed publishes that priority as a WebMCP contract.”

**[Show six tools; inspect and list options]** “The client discovers six page-defined tools. It can
inspect the current promise and browser signals, list the protected work, and see the next measured
cut—without guessing selectors.”

**[Set contract; protect `mark-note`]** “Set a one-hundred-millisecond contract for Live trace, then
protect Mixer status. The agent acts only through page-owned IDs and callbacks. The page shows both
agent-stamped receipts.”

**[Raise Crowd load; person clicks Tap]** “Now the person raises the crowd load and supplies the
click. Loadshed measures a long frame and cuts the registered crowd work from four hundred eighty to
forty-eight. The live trace and mixer stay useful.”

**[Read receipts]** “The receipt says what changed, who caused it, which signal justified it, and
what evidence is still missing. Injected clicks never become trusted evidence.”

**[Turn promise off; flash Sale]** “Turn the promise off, and full fidelity returns. Sale uses the
same six tools with a different page-owned priority: Hold my size. Loadshed is a small runtime for
honest human-agent responsiveness contracts on the open web.”

## Devpost final-form map

The account is already registered for the challenge. The live submission form was re-read on August
29, 2026; these IDs and answers are a handoff, not a submitted entry.

| Field | Prepared answer or operator boundary |
| --- | --- |
| `28249` Submitter Type | **OPERATOR:** choose Individual, Team of Individuals, or Organization. |
| `28250` Country of residence | **OPERATOR:** select the actual country for every submitter. |
| `28251` Organization name | Leave blank unless submitting on behalf of an organization. |
| `28252` App Status | **New.** Development began August 26, after the challenge opened. |
| `28253` Existing-project updates | Leave blank because the project is new. |
| `28254` Live URL | `https://mcs-eng.github.io/loadshed/` |
| `28255` Testing instructions | Open the root in ChatGPT's in-app browser or Chrome 149+ with WebMCP enabled; confirm **tools ready**; inspect responsiveness and options; set a 100 ms `live-trace` contract; protect `mark-note`; move Crowd load to 100%; click Tap yourself; wait for Crowd 480 to 48; compare the visible rail with `get_intervention_receipts`; turn the promise off; repeat on Sale with `hold-size` and `hold-note`. No credentials are required. |
| `28256` Public code repository | `https://github.com/mcs-eng/loadshed` |
| `28257` Tested clients | ChatGPT in-app browser (September 1, 2026): full six-tool Desk and Sale qualification with physical clicks against public `74c13a8`. Codex in-app browser (August 29): live six-tool Desk and Sale qualification. Edge 152: runtime and reduced-motion smoke, not a WebMCP-agent qualification. **If a named-client pass against `e031503` is run, name it here.** |
| `28258` AI tools used | OpenAI Codex, including Sol, Terra, and Luna review passes; Anthropic Claude; xAI Grok; and Agy. |
| `28259` Learning level | **OPERATOR:** choose None, Moderate, or Significant. |
| `28260` Career AI value | **OPERATOR:** choose Yes or No. |
| Demo video | **OPERATOR:** paste the public narrated YouTube URL after verifying it. |

Do not call final submit until every required answer and the video URL are present, the named-client
run is recorded, and the operator has reviewed the rendered project page and explicitly authorized
submission.

## Operator close-out checklist

- [x] Choose the public project name and repository owner.
- [x] Run the allowlisted public exporter, initialize a new repository from its output, and confirm
  only sanitized history is reachable.
- [x] Make `LICENSE` detectable in the repository About panel.
- [x] Choose a static host and deploy the exact reviewed source commit.
- [x] Complete a live hosted six-tool qualification and record its bounded receipt.
- [x] Capture screenshots without credentials, private data, browser profiles, or unrelated tabs.
- [x] Repeat the qualification in ChatGPT's in-app browser or Chrome 149+ with a physical click.
  (Done 2026-09-01 in ChatGPT's in-app browser against public commit `74c13a8`; see the
  September 1 qualification receipt above.)
- [x] Tag the judged commit: public `e031503` carries annotated tag `v0.1.0-submission`
  (pushed 2026-09-01).
- [x] Devpost draft text updated 2026-09-01: test count 49, both "320.157 ms" figures rounded
  to "about 320 ms", and one paragraph naming `e031503` and the post-merge smoke.
- [ ] Recommended, not required: repeat one named-client pass (ChatGPT in-app browser or
  Chrome 149+) against public `e031503` and record it in the tested-clients row.
- [ ] Record, edit, and publicly upload the narrated video; verify runtime is less than 3:00.
  Use the private clone's `VIDEO-RECORDING-SHEET.md` at the mic (not part of the public export).
- [ ] Replace the remaining YouTube placeholder with the public video URL.
- [x] Publish and review the project description in the Devpost draft.
- [ ] Submit before September 3, 2026 at 1:00 PM Pacific, then preserve the submitted artifacts
  through judging.

Official requirements and browser setup: <https://webmcp.devpost.com/rules>.
