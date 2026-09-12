import { existsSync, mkdirSync, readFileSync, readdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, process.argv[2] || 'outputs/oyo-backend');
if (existsSync(destination)) throw new Error('Choose a new destination: export never overwrites an existing directory.');
const project = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const names = ['bcryptjs', 'cors', 'express', 'jsonwebtoken', 'pg', 'sharp', 'socket.io'];
const dependencies = Object.fromEntries(names.map(name => {
  const version = lock.packages?.[`node_modules/${name}`]?.version;
  if (!version || !project.dependencies[name]) throw new Error(`No installed lockfile version for ${name}`);
  return [name, version];
}));
const files=[];
function collect(directory) {
  for (const entry of readdirSync(join(root,directory), {withFileTypes:true})) {
    const path=`${directory}/${entry.name}`;
    if(entry.isSymbolicLink())continue;
    if(entry.isDirectory()) {if(!['node_modules','agent-imports'].includes(entry.name))collect(path);}
    else if(/\.(js|mjs)$/.test(entry.name) || (directory==='server/data' && entry.name.endsWith('.json')))files.push(path);
  }
}
collect('server'); collect('shared');
files.push('scripts/test-backend.mjs','scripts/backend-smoke.mjs','docs/EIGARS-OYO-ARCHITECTURE.md');
mkdirSync(destination,{recursive:true});
for(const file of files){const target=join(destination,file);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(root,file),target);}
writeFileSync(join(destination,'package.json'),JSON.stringify({name:'eigars-oyo-api',version:'0.1.0',private:true,type:'module',engines:{node:'>=22.12.0'},scripts:{start:'node server/index.js',test:'node scripts/test-backend.mjs','test:smoke':'node scripts/backend-smoke.mjs'},dependencies},null,2)+'\n');
writeFileSync(join(destination,'.gitignore'),'node_modules/\n.env\nserver/data.json\nserver/agent-imports/\n');
writeFileSync(join(destination,'.env.example'),'NODE_ENV=production\nAPI_ONLY=true\nPORT=5000\nJWT_SECRET=replace-with-at-least-32-random-bytes\nSUPER_ADMIN_PASSWORD=replace-with-a-strong-password\nADMIN_PASSWORD=replace-with-a-strong-password\nCORS_ORIGIN=https://your-frontend.example\nDATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE\nIREV_AUTO_SYNC=false\nENABLE_OSUN_PILOT=true\n');
writeFileSync(join(destination,'README.md'),'# Oyo Election Intelligence API\n\nExported backend source, with shared domain data and tests. Runtime data and credentials are excluded.\n\n1. Run `npm install` and commit the resulting lockfile.\n2. Configure environment variables in your deployment; `.env.example` is documentation, not automatically loaded.\n3. Set `API_ONLY=true` and configure PostgreSQL, JWT_SECRET, seed administrator passwords and CORS_ORIGIN.\n4. Run `npm test` and `npm run test:smoke`, then `npm start`.\n\nSee `docs/EIGARS-OYO-ARCHITECTURE.md` for current capabilities and production release gates. No database was copied or migrated.\n');
console.log(`Exported ${files.length} source files to ${relative(root,destination) || destination}. No runtime database or credentials were copied.`);
