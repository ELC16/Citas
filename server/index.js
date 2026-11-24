process.env.TZ ||= 'America/Mexico_City'; // las citas se evalúan en hora local
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite'; // integrado en Node >= 22.13, sin compilar nada
import { checkPw, makeToken, validToken } from './auth.js';

const cfg = fs.existsSync('config.json') ? JSON.parse(fs.readFileSync('config.json')) : {};
const PW_HASH = process.env.ADMIN_PASSWORD_HASH || cfg.hash || '';
const SECRET = process.env.SECRET_KEY || cfg.secret || '';

const db = new DatabaseSync(process.env.DB_PATH || 'citas.db');
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS servicios(id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL COLLATE NOCASE,
  descripcion TEXT NOT NULL DEFAULT '' COLLATE NOCASE, duracion_min INTEGER NOT NULL CHECK(duracion_min BETWEEN 5 AND 480), costo REAL NOT NULL CHECK(costo >= 0),
  UNIQUE(nombre, descripcion));  -- mismo nombre permitido si la descripción cambia
CREATE TABLE IF NOT EXISTS horario(dia INTEGER PRIMARY KEY CHECK(dia BETWEEN 0 AND 6), abierto INTEGER NOT NULL, inicio TEXT NOT NULL, fin TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS citas(id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL COLLATE NOCASE,
  servicio_id INTEGER NOT NULL REFERENCES servicios(id) ON DELETE CASCADE, horario TEXT NOT NULL, duracion_min INTEGER NOT NULL DEFAULT 30, creada TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(nombre, servicio_id, horario),  -- Regla A
  UNIQUE(servicio_id, horario));         -- Regla B`);

if (!db.prepare('PRAGMA table_info(citas)').all().some(c => c.name === 'duracion_min')) // migración de bases anteriores
  db.exec('ALTER TABLE citas ADD COLUMN duracion_min INTEGER NOT NULL DEFAULT 30; UPDATE citas SET duracion_min = COALESCE((SELECT duracion_min FROM servicios WHERE id = servicio_id), 30)');
for (let d = 0; d < 7; d++) db.prepare('INSERT OR IGNORE INTO horario VALUES(?,?,?,?)').run(d, d > 0 && d < 6 ? 1 : 0, '09:00', '18:00'); // lun-vie por defecto

class Err extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const p = n => String(n).padStart(2, '0');
const ahora = () => { const d = new Date(); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const hm = t => { const [h, m] = t.split(':'); return h * 60 + +m; };
const fechaOk = f => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f); if (!m) return false; const d = new Date(+m[1], m[2] - 1, +m[3]); return d.getMonth() === m[2] - 1 && d.getDate() === +m[3]; };
const slots = (dur, f, paso = dur) => {
  const o = [];
  if (!fechaOk(f)) return o;
  const [y, mo, d] = f.split('-').map(Number);
  const h = db.prepare('SELECT * FROM horario WHERE dia=?').get(new Date(y, mo - 1, d).getDay());
  if (!h?.abierto) return o;
  for (let m = hm(h.inicio); m + dur <= hm(h.fin); m += paso) o.push(`${f} ${p((m / 60) | 0)}:${p(m % 60)}`);
  return o;
};
// Un solo prestador: ninguna cita puede empalmarse con otra, sea del servicio que sea.
const paso = () => db.prepare('SELECT MIN(duracion_min) m FROM servicios').get().m || 30; // las horas se ofrecen cada "paso" minutos
const libre = (f, ini, dur) => !db.prepare('SELECT horario, duracion_min FROM citas WHERE horario LIKE ?').all(f + ' %')
  .some(c => { const s = hm(c.horario.slice(11)); return ini < s + c.duracion_min && ini + dur > s; });
const servicio = id = db.prepare('SELECT * FROM servicios WHERE id=?').get(id) ?? (() => { throw new Err(404, 'Servicio no existe'); })();

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
  try { res.status(201).json({ id: Number(db.prepare('INSERT INTO servicios(nombre,descripcion,duracion_min,costo) VALUES(?,?,?,?)').run(n, String(req.body.descripcion ?? '').trim().slice(0, 300), dur, costo).lastInsertRowid) }); }
  catch (e) { throw /UNIQUE/.test(e.message) ? new Err(409, 'Ya existe un servicio con el mismo nombre y la misma descripción') : e; }
});
app.delete('/api/servicios/:id', auth, (req, res) => { db.prepare('DELETE FROM servicios WHERE id=?').run(req.params.id); res.json({ ok: true }); });
app.get('/api/horario', (_q, res) => res.json(db.prepare('SELECT dia, abierto, inicio, fin FROM horario ORDER BY dia').all()));
app.put('/api/horario', auth, (req, res) => {
  const rows = req.body.dias, t = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!(Array.isArray(rows) && rows.length === 7 && rows.every(r => Number.isInteger(r.dia) && r.dia >= 0 && r.dia <= 6 && t.test(r.inicio) && t.test(r.fin) && (!r.abierto || hm(r.inicio) < hm(r.fin)))))
    throw new Err(400, 'Revisa los horarios: el cierre debe ser posterior a la apertura');
  const up = db.prepare('UPDATE horario SET abierto=?, inicio=?, fin=? WHERE dia=?');
  for (const r of rows) up.run(r.abierto ? 1 : 0, r.inicio, r.fin, r.dia);
  res.json({ ok: true });
});
app.get('/api/disponibilidad', (req, res) => {
  const s = servicio(req.query.servicio_id), f = String(req.query.fecha ?? '');
  if (!fechaOk(f)) throw new Err(400, 'Parámetros inválidos');
  res.json(slots(s.duracion_min, f, paso()).filter(h => libre(f, hm(h.slice(11)), s.duracion_min) && h > ahora()).map(h => h.slice(11)));
});
app.post('/api/citas', (req, res) => {
  const nombre = String(req.body.nombre ?? '').trim(), horario = String(req.body.horario ?? '').trim();
  if (nombre.length < 2 || nombre.length > 80) throw new Err(400, 'Escribe tu nombre (2-80 caracteres)');
  const s = servicio(req.body.servicio_id);
  if (!slots(s.duracion_min, horario.slice(0, 10), paso()).includes(horario) || horario <= ahora()) throw new Err(400, 'Horario no válido');
  if (!libre(horario.slice(0, 10), hm(horario.slice(11)), s.duracion_min)) throw new Err(409, 'Ese horario ya no está disponible. Elige otro');
  try { const r = db.prepare('INSERT INTO citas(nombre,servicio_id,horario,duracion_min) VALUES(?,?,?,?)').run(nombre, s.id, horario, s.duracion_min); res.status(201).json({ id: Number(r.lastInsertRowid), servicio: s.nombre, costo: s.costo, horario }); }
  catch (e) { throw /UNIQUE/.test(e.message) ? new Err(409, 'Ese horario ya no está disponible para este servicio') : e; }
});
app.get('/api/citas', auth, (_q, res) => res.json(db.prepare('SELECT c.id,c.nombre,c.horario,c.duracion_min,s.nombre servicio,s.costo FROM citas c JOIN servicios s ON s.id=c.servicio_id ORDER BY c.horario').all()));
app.delete('/api/citas/:id', auth, (req, res) => { db.prepare('DELETE FROM citas WHERE id=?').run(req.params.id); res.json({ ok: true }); });

app.use((e, _q, res, _n) => { if (!(e instanceof Err)) console.error(e); res.status(e.code || 500).json({ error: e instanceof Err ? e.message : 'Error interno' }); });
app.listen(process.env.PORT || 3000, () => console.log('API de citas lista'));
