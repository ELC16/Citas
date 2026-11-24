import readline from 'node:readline';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { hashPw } from './auth.js';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let mute = false;
rl._writeToOutput = s => { if (!mute) process.stdout.write(s); };
const ask = q => new Promise(r => { process.stdout.write(q); mute = true; rl.question('', a => { mute = false; process.stdout.write('\n'); r(a); }); });
const a = await ask('Contraseña de administrador (mín. 10 caracteres): ');
const b = await ask('Repítela: ');
rl.close();
if (a !== b || a.length < 10) { console.error('No coinciden o son menos de 10 caracteres.'); process.exit(1); }
const cfg = { hash: hashPw(a), secret: crypto.randomBytes(32).toString('hex') };
fs.writeFileSync('config.json', JSON.stringify(cfg), { mode: 0o600 });
console.log('\nconfig.json creado. Para hosting en la nube, define estas variables de entorno:');
console.log(`ADMIN_PASSWORD_HASH=${cfg.hash}\nSECRET_KEY=${cfg.secret}`);
