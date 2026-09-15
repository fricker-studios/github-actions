import {createHash} from 'node:crypto';
import {readFileSync, realpathSync, appendFileSync} from 'node:fs';
import {resolve, relative, isAbsolute, join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const hash = value => createHash('sha256').update(value).digest('hex');
export function prepare({workspace, directory, temp, epoch, runtime, npmVersion}) {
  if (!/^[a-zA-Z0-9._-]+$/.test(epoch)) throw new Error('Invalid cache epoch');
  const root = realpathSync(workspace);
  const project = realpathSync(resolve(root, directory));
  const rel = relative(root, project);
  if (rel.startsWith('..') || isAbsolute(rel) || /[\r\n]/.test(project)) throw new Error('Project must be inside workspace');
  const lockPath = realpathSync(join(project, 'package-lock.json'));
  if (relative(project, lockPath) !== 'package-lock.json') throw new Error('Lockfile must not be a symlink outside project');
  const bytes = readFileSync(lockPath);
  const lock = JSON.parse(bytes);
  if (![2, 3].includes(lock.lockfileVersion) || !lock.packages) throw new Error('Requires npm lockfile v2 or v3');
  // Cache archives can be read by PR jobs. This action deliberately supports
  // public npm tarballs only, never private registry packages or git dependencies.
  for (const [name, pkg] of Object.entries(lock.packages)) {
    if (!name) continue;
    if (pkg.link || !pkg.resolved || !pkg.integrity) throw new Error(`Missing locked tarball/integrity: ${name}`);
    const url = new URL(pkg.resolved);
    if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org' || url.port || url.username || url.password || url.search || url.hash) {
      throw new Error(`Only public registry.npmjs.org tarballs are supported: ${name}`);
    }
    if (!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(pkg.integrity)) throw new Error(`Requires SHA-512 integrity: ${name}`);
  }
  const projectId = hash(rel || '.').slice(0, 16);
  const prefix = `npm-public-${epoch}-${runtime}-${npmVersion.split('.')[0]}-${projectId}-`;
  return {key: prefix + hash(bytes), prefix, cache: join(temp, `npm-public-${projectId}`), lockPath, lockHash: hash(bytes)};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.platform !== 'linux') throw new Error('This pilot supports Linux runners only');
  const libc = process.platform === 'linux' ? (process.report.getReport().header.glibcVersionRuntime ? 'glibc' : 'musl') : 'native';
  const result = prepare({workspace: process.env.GITHUB_WORKSPACE, directory: process.env.NPM_PROJECT,
    temp: process.env.RUNNER_TEMP, epoch: process.env.CACHE_EPOCH,
    runtime: `${process.platform}-${process.arch}-${libc}-node${process.versions.node.split('.')[0]}`,
    npmVersion: execFileSync('npm', ['--version'], {encoding: 'utf8'}).trim()});
  for (const [key, value] of Object.entries(result)) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  appendFileSync(process.env.GITHUB_ENV, `NPM_CONFIG_CACHE=${result.cache}\nNPM_CONFIG_PREFER_OFFLINE=true\n`);
}
