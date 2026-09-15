import {readFileSync, readdirSync, lstatSync, unlinkSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

// The npm cache format is partitioned by npm major in the action's key.
// Prune only this job's cache, after npm exits. npm cache verify subsequently
// removes stale index references using npm's own supported maintenance command.
export function prune(cache, lockPath) {
  const keep = new Set(Object.values(JSON.parse(readFileSync(lockPath)).packages)
    .filter(pkg => pkg.integrity?.startsWith('sha512-'))
    .map(pkg => Buffer.from(pkg.integrity.slice(7), 'base64').toString('hex')));
  const root = join(cache, '_cacache', 'content-v2');
  if (!existsSync(root)) return {removed: 0, bytes: 0};
  for (const path of [cache, join(cache, '_cacache'), root]) {
    if (!lstatSync(path).isDirectory()) throw new Error('Cache directory must not be a symlink');
  }
  let removed = 0, bytes = 0;
  function walk(path, parts = []) {
    for (const name of readdirSync(path)) {
      const child = join(path, name), stat = lstatSync(child), next = [...parts, name];
      if (stat.isSymbolicLink()) throw new Error('Unexpected cache symlink');
      if (stat.isDirectory()) walk(child, next);
      else if (stat.isFile()) {
        const retained = next[0] === 'sha512' && keep.has(next.slice(1).join(''));
        if (!retained) {unlinkSync(child); removed++; bytes += stat.size;}
      } else throw new Error('Unexpected cache file type');
    }
  }
  walk(root);
  return {removed, bytes};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(prune(process.env.NPM_CONFIG_CACHE, process.env.LOCK_PATH)));
}
