import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const required = [
  'JWT_SECRET',
  'SUPER_ADMIN_PASSWORD',
  'ADMIN_PASSWORD',
  'CORS_ORIGIN'
];
const envExample = readFileSync(join(root, '.env.example'), 'utf8');
const missing = required.filter(name => !envExample.includes(`${name}=`));
if (missing.length) {
  console.error(`Missing security env declarations: ${missing.join(', ')}`);
  process.exit(1);
}
const hasStartScript = pkg.scripts?.start && pkg.scripts.start.includes('node server/index.js');
if (!hasStartScript) {
  console.error('Server start script is not configured properly.');
  process.exit(1);
}
console.log('Security config checks passed.');
