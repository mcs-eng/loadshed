'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('reviewers get a runnable root README with the canonical judge path', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /http:\/\/localhost:8080\//);
  assert.match(readme, /node --test test\\\*\.test\.js/);
  assert.match(readme, /inspect_responsiveness/);
  assert.match(readme, /Chrome 149\+/);
  assert.match(readme, /MIT/i);
});

test('submission handoff separates repository evidence from operator-owned artifacts', () => {
  const handoff = fs.readFileSync(path.join(root, 'SUBMISSION.md'), 'utf8');
  assert.match(handoff, /Live URL.*PENDING/i);
  assert.match(handoff, /Public repository.*PENDING/i);
  assert.match(handoff, /YouTube video.*PENDING/i);
  assert.match(handoff, /do not publish the existing Git history/i);
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
  assert.match(exporter, /'src\/loadshed\.js'/);
  assert.match(exporter, /'test\/repository-readiness\.test\.js'/);
  assert.doesNotMatch(exporter, /tournament\/|agy_draft|BUILD-DAY|BUILD-ORDER/);
  assert.doesNotMatch(exporter, /'desk\/|'pair\//);
});
