import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepare} from './prepare.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'npm-cache-test-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  mkdirSync(join(root, 'frontend'));
  const lock = {lockfileVersion: 3, packages: {'': {}, 'node_modules/a': {
    resolved: 'https://registry.npmjs.org/a/-/a-1.0.0.tgz', integrity: 'sha512-YWJjZA=='}}};
  const save = () => writeFileSync(join(root, 'frontend/package-lock.json'), JSON.stringify(lock));
  save();
  const args = {workspace: root, directory: 'frontend', temp: '/tmp/job', epoch: 'v1', runtime: 'linux-x64-glibc-node24', npmVersion: '11.8.0'};
  return {args, lock, save};
}
test('lockfile updates reuse prefix but invalidate exact key', t => {
  const {args, lock, save} = fixture(t); const before = prepare(args);
  lock.packages['node_modules/a'].resolved = 'https://registry.npmjs.org/a/-/a-1.0.1.tgz'; save();
  const after = prepare(args);
  assert.equal(before.prefix, after.prefix); assert.notEqual(before.key, after.key);
  assert.match(before.cache, /^\/tmp\/job\/npm-public-/);
});
test('runtime, architecture, libc, npm and epoch isolate cache families', t => {
  const {args} = fixture(t); const a = prepare(args);
  for (const change of [{runtime: 'linux-arm64-glibc-node24'}, {runtime: 'linux-x64-musl-node24'}, {runtime: 'linux-x64-glibc-node22'}, {npmVersion: '12.0.0'}, {epoch: 'v2'}]) {
    assert.notEqual(prepare({...args, ...change}).prefix, a.prefix);
  }
});
test('private registries, missing integrity, git and local dependencies fail closed', t => {
  const {args, lock, save} = fixture(t);
  for (const pkg of [
    {resolved: 'https://npm.pkg.github.com/a', integrity: 'sha512-YQ=='},
    {resolved: 'https://registry.npmjs.org/a'},
    {resolved: 'git+https://github.com/example/a'},
    {link: true, resolved: '../a'},
    {resolved: 'https://user:password@registry.npmjs.org/a', integrity: 'sha512-YQ=='}
  ]) {lock.packages['node_modules/a'] = pkg; save(); assert.throws(() => prepare(args));}
});
test('reject path escape and output injection', t => {
  const {args} = fixture(t);
  assert.throws(() => prepare({...args, directory: '..'}));
  assert.throws(() => prepare({...args, epoch: 'v1\nevil=1'}));
});
