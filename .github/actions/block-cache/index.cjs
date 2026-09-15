const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
// Runtime variables are injected into JavaScript actions, not shell steps.
const host = new URL(process.env.ACTIONS_RESULTS_URL).hostname;
if (!/^[a-z0-9.-]+$/i.test(host)) throw Error('Unexpected cache hostname');
const backup = path.join(process.env.RUNNER_TEMP, 'cache-test-original-hosts');
fs.writeFileSync(backup, fs.readFileSync('/etc/hosts'));
execFileSync('sudo', ['tee', '-a', '/etc/hosts'], {input: `\n127.0.0.1 ${host}\n`, stdio: ['pipe', 'ignore', 'inherit']});
console.log(`Blocked cache hostname ${host} for this disposable runner`);
