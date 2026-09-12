import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
function tests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? tests(`${directory}/${entry.name}`) : entry.name.endsWith('.test.js') ? [`${directory}/${entry.name}`] : []);
}
const child = spawn(process.execPath, ['--test', ...tests('server'), ...tests('shared')], { stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
