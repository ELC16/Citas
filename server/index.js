process.env.TZ ||= 'America/Mexico_City'; // las citas se evalúan en hora local
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite'; // integrado en Node >= 22.13, sin compilar nada
import { checkPw, makeToken, validToken } from './auth.js';

const cfg = fs.existsSync('config.json') ? JSON.parse(fs.readFileSync('config.json')) : {};
const PW_HASH = process.env.ADMIN_PASSWORD_HASH || cfg.hash || '';
const SECRET = process.env.SECRET_KEY || cfg.secret || '';
const HORA_INICIO = 9, HORA_FIN = 18;

const db = new DatabaseSync(process.env.DB_PATH || 'citas.db');
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS servicios(id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
  descripcion TEXT DEFAULT '', duracion_min INTEGER NOT NULL CHECK(duracion_min BETWEEN 5 AND 480), costo REAL NOT NULL CHECK(costo >= 0));
CREATE TABLE IF NOT EXISTS citas(id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL COLLATE NOCASE,
  servicio_id INTEGER NOT NULL REFERENCES servicios(id) ON DELETE CASCADE, horario TEXT NOT NULL, creada TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(nombre, servicio_id, horario),  -- Regla A
  UNIQUE(servicio_id, horario));         -- Regla B`);

class Err extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const p = n => String(n).padStart(2, '0');
const ahora = () => { const d = new Date(); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const slots = (dur, f) => { const o = []; for (let m = HORA_INICIO * 60; m + dur <= HORA_FIN * 60; m += dur) o.push(`${f} ${p((m / 60) | 0)}:${p(m % 60)}`); return o; };
const servicio = id => db.prepare('SELECT * FROM servicios WHERE id=?').get(id) ?? (() => { throw new Err(404, 'Servicio no existe'); })();

const intentos = new Map();
const frenado = ip => { const [n, t0] = intentos.get(ip) ?? [0, Date.now()]; const r = Date.now() - t0 > 9e5 ? [0, Date.now()] : [n, t0]; intentos.set(ip, [r[0] + 1, r[1]]); return r[0] >= 5; };
const auth = (req, _res, next) => validToken(req.get('X-Admin-Token'), SECRET) ? next() : next(new Err(401, 'Sesión no válida. Inicia sesión de nuevo'));

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false })); // ej: https://usuario.github.io
app.use(express.json({ limit: '10kb' }));
app.use((_q, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }); next(); });

app.post('/api/login', (req, res) => {
  if (!PW_HASH || !SECRET) throw new Err(503, 'Falta configurar la contraseña (npm run setup)');
  if (frenado(req.ip)) throw new Err(429, 'Demasiados intentos. Espera 15 minutos');
  if (!checkPw(String(req.body.password ?? ''), PW_HASH)) throw new Err(401, 'Contraseña incorrecta');
  intentos.delete(req.ip);
  res.json({ token: makeToken(SECRET) });
});
app.get('/api/servicios', (_q, res) => res.json(db.prepare('SELECT * FROM servicios ORDER BY nombre').all()));
app.post('/api/servicios', auth, (req, res) => {
  const n = String(req.body.nombre ?? '').trim(), dur = Number(req.body.duracion_min), costo = Number(req.body.costo);
  if (!n || n.length > 80 || !(dur >= 5 && dur <= 480) || !(costo >= 0)) throw new Err(400, 'Revisa nombre, duración (5-480 min) y costo');
  try { res.status(201).json({ id: Number(db.prepare('INSERT INTO servicios(nombre,descripcion,duracion_min,costo) VALUES(?,?,?,?)').run(n, String(req.body.descripcion ?? '').slice(0, 300), dur, costo).lastInsertRowid) }); }
  catch (e) { throw /UNIQUE/.test(e.message) ? new Err(409, 'Ya existe un servicio con ese nombre') : e; }
});
app.delete('/api/servicios/:id', auth, (req, res) => { db.prepare('DELETE FROM servicios WHERE id=?').run(req.params.id); res.json({ ok: true }); });
app.get('/api/disponibilidad', (req, res) => {
  const s = servicio(req.query.servicio_id), f = String(req.query.fecha ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) throw new Err(400, 'Parámetros inválidos');
  const oc = new Set(db.prepare('SELECT horario FROM citas WHERE servicio_id=?').all(s.id).map(r => r.horario));
  res.json(slots(s.duracion_min, f).filter(h => !oc.has(h) && h > ahora()).map(h => h.slice(11)));
});
app.post('/api/citas', (req, res) => {
  const nombre = String(req.body.nombre ?? '').trim(), horario = String(req.body.horario ?? '').trim();
  if (nombre.length < 2 || nombre.length > 80) throw new Err(400, 'Escribe tu nombre (2-80 caracteres)');
  const s = servicio(req.body.servicio_id);
  if (!slots(s.duracion_min, horario.slice(0, 10)).includes(horario) || horario <= ahora()) throw new Err(400, 'Horario no válido');
  try { const r = db.prepare('INSERT INTO citas(nombre,servicio_id,horario) VALUES(?,?,?)').run(nombre, s.id, horario); res.status(201).json({ id: Number(r.lastInsertRowid), servicio: s.nombre, costo: s.costo, horario }); }
  catch (e) { throw /UNIQUE/.test(e.message) ? new Err(409, 'Ese horario ya no está disponible para este servicio') : e; }
});
app.get('/api/citas', auth, (_q, res) => res.json(db.prepare('SELECT c.id,c.nombre,c.horario,s.nombre servicio,s.costo FROM citas c JOIN servicios s ON s.id=c.servicio_id ORDER BY c.horario').all()));
app.delete('/api/citas/:id', auth, (req, res) => { db.prepare('DELETE FROM citas WHERE id=?').run(req.params.id); res.json({ ok: true }); });

app.use((e, _q, res, _n) => { if (!(e instanceof Err)) console.error(e); res.status(e.code || 500).json({ error: e instanceof Err ? e.message : 'Error interno' }); });
app.listen(process.env.PORT || 3000, () => console.log('API de citas lista'));
