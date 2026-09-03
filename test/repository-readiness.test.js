'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

test('reviewers get runnable judge and reusable teleprompter paths', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /https:\/\/mcs-eng\.github\.io\/loadshed\//);
  assert.match(readme, /https:\/\/github\.com\/mcs-eng\/loadshed/);
  assert.match(readme, /assets\/loadshed-live-proof\.jpg/);
  assert.match(readme, /http:\/\/localhost:8080\//);
  assert.match(readme, /node --test test\\\*\.test\.js/);
  assert.match(readme, /inspect_responsiveness/);
  assert.match(readme, /Chrome 149\+/);
  assert.match(readme, /teleprompter\//i);
  assert.match(readme, /MIT/i);

  const prompter = fs.readFileSync(path.join(root, 'teleprompter', 'index.html'), 'utf8');
  assert.match(prompter, /<textarea[^>]+id="script-input"/);
  assert.match(prompter, /id="start-button"/);
  assert.match(prompter, /id="pause-button"/);
  assert.match(prompter, /id="speed-control"[^>]+type="range"/);
  assert.match(prompter, /id="size-control"[^>]+type="range"/);
  assert.match(prompter, /id="mirror-toggle"[^>]+type="checkbox"/);
  assert.match(prompter, /id="highlight-toggle"[^>]+type="checkbox"/);
  assert.match(prompter, /requestFullscreen/);
  assert.match(prompter, /localStorage/);
  assert.match(prompter, /prefers-reduced-motion/);
  assert.doesNotMatch(prompter, /<script[^>]+src=|<link[^>]+rel="stylesheet"/i);
  assert.doesNotMatch(prompter, /\b(?:fetch|XMLHttpRequest|WebSocket|getUserMedia)\s*\(/);
  const inlineScript = prompter.match(/<script>([\s\S]+)<\/script>/)?.[1];
  assert.ok(inlineScript, 'teleprompter must contain its executable behavior inline');
  assert.doesNotThrow(() => new vm.Script(inlineScript), 'teleprompter inline script must parse');
  assert.match(inlineScript, /className = 'prompt-word'/);
  assert.match(inlineScript, /function updateCurrentWord\(/);
  assert.match(inlineScript, /const READOUT_INTERVAL_MS = 250/);
  assert.match(inlineScript, /const MAX_HIGHLIGHT_WORDS = 5_000/);
  assert.match(inlineScript, /spokenWords <= MAX_HIGHLIGHT_WORDS/);
  const tickSource = inlineScript.slice(
    inlineScript.indexOf('function tick(now)'),
    inlineScript.indexOf('function beginScrolling()')
  );
  assert.doesNotMatch(tickSource, /scrollDistance\(|pixelsPerSecond\(/);
  assert.doesNotMatch(tickSource, /Math\.min\(100,/);
  const paceHandlerSource = inlineScript.slice(
    inlineScript.indexOf("speedControl.addEventListener('input'"),
    inlineScript.indexOf('for (const control of [sizeControl')
  );
  assert.match(paceHandlerSource, /updatePaceMetrics\(/);
  assert.doesNotMatch(paceHandlerSource, /applySettings\(|scheduleMetricsRefresh\(|refreshMotionMetrics\(/);
  const startSource = inlineScript.slice(
    inlineScript.indexOf('async function startOneShot()'),
    inlineScript.indexOf('function pause()')
  );
  assert.match(startSource, /async function startOneShot\(\)/);
  const fullscreenAwait = startSource.indexOf('await requestPromptFullscreen()');
  const finalMeasure = startSource.lastIndexOf('refreshMotionMetrics()');
  const countdownStart = startSource.indexOf('beginCountdown(');
  assert.ok(fullscreenAwait >= 0, 'automatic fullscreen must be awaited');
  assert.ok(finalMeasure > fullscreenAwait, 'prompt geometry must be measured after fullscreen settles');
  assert.ok(countdownStart > finalMeasure, 'countdown must start after final fullscreen geometry');
  assert.match(startSource, /const attempt = \+\+startAttempt/);
  assert.match(
    startSource,
    /if \(attempt !== startAttempt \|\| !body\.classList\.contains\('is-on-air'\)\) return;/,
    'canceling during fullscreen startup must prevent the async continuation from starting a countdown'
  );
  assert.match(inlineScript, /starting: 'Preparing prompt'/);
  assert.match(inlineScript, /nextState === 'starting'/);
  assert.match(
    inlineScript,
    /if \(runState === 'starting' && key !== 'e' && event\.key !== 'Escape'\)/,
    'on-air shortcuts must not compete with fullscreen startup'
  );
  const exitSource = inlineScript.slice(
    inlineScript.indexOf('async function exitToEditor()'),
    inlineScript.indexOf('async function toggleFullscreen()')
  );
  assert.match(exitSource, /startAttempt \+= 1/);
  const visibilitySource = inlineScript.slice(
    inlineScript.indexOf("document.addEventListener('visibilitychange'"),
    inlineScript.indexOf("window.addEventListener('beforeunload'")
  );
  assert.match(
    visibilitySource,
    /if \(runState === 'starting'\) void exitToEditor\(\)/,
    'hiding a pending fullscreen start must invalidate it before any countdown begins'
  );
});

test('submission handoff records published artifacts without overstating operator-owned work', () => {
  const handoff = fs.readFileSync(path.join(root, 'SUBMISSION.md'), 'utf8');
  assert.match(handoff, /Live URL.*https:\/\/mcs-eng\.github\.io\/loadshed\//i);
  assert.match(handoff, /Public repository.*https:\/\/github\.com\/mcs-eng\/loadshed/i);
  assert.match(handoff, /YouTube video.*PENDING/i);
  assert.match(handoff, /Devpost entry.*PUBLIC DRAFT.*https:\/\/devpost\.com\/software\/loadshed/i);
  assert.match(handoff, /Qualification receipt.*August 29, 2026/i);
  assert.match(handoff, /qualified product release was public commit `93f8d1a`/i);
  assert.match(handoff, /ChatGPT's in-app browser or Chrome 149\+/i);
  assert.match(handoff, /do not publish this private repository's Git history/i);
  assert.match(handoff, /less than three minutes/i);
  assert.match(handoff, /set_smoothness_contract/);
});

test('raw transcript logs are absent from the release tree', () => {
  const logDirectory = path.join(root, 'tournament', 'logs');
  const rawLogs = fs.existsSync(logDirectory)
    ? fs.readdirSync(logDirectory).filter((name) => name.endsWith('.log'))
    : [];
  assert.deepEqual(rawLogs, []);
});

test('public release export is allowlisted and excludes internal development artifacts', () => {
  const exporter = fs.readFileSync(path.join(root, 'scripts', 'Export-PublicRelease.ps1'), 'utf8');
  assert.match(exporter, /Destination must be outside the source repository/);
  assert.match(exporter, /Destination must be empty/);
  assert.match(exporter, /'index\.html'/);
  assert.match(exporter, /'assets\/loadshed-live-proof\.jpg'/);
  assert.match(exporter, /'src\/loadshed\.js'/);
  assert.match(exporter, /'teleprompter\/index\.html'/);
  const testFiles = fs.readdirSync(path.join(root, 'test')).filter((name) => name.endsWith('.test.js'));
  for (const name of testFiles) {
    assert.ok(exporter.includes(`'test/${name}'`), `public export must include test/${name}`);
  }
  assert.doesNotMatch(exporter, /tournament\/|agy_draft|BUILD-DAY|BUILD-ORDER/);
  assert.doesNotMatch(exporter, /'desk\/|'pair\//);
});
