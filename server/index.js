process.env.TZ ||= 'America/Mexico_City'; // las citas se evalúan en hora local
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite'; // integrado en Node >= 22.13
import { hashPw, checkPw, makeToken, validToken } from './auth.js';

const CATEGORIAS = ['Belleza y peluquería', 'Barbería', 'Salud y consultorios', 'Dental', 'Spa y bienestar', 'Mascotas', 'Automotriz', 'Fitness y deporte', 'Educación', 'Otros'];
const db = new DatabaseSync(process.env.DB_PATH || 'citas.db');
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS negocios(id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL COLLATE NOCASE, categoria TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '', direccion TEXT NOT NULL DEFAULT '' COLLATE NOCASE, telefono TEXT NOT NULL DEFAULT '',
  lat REAL NOT NULL, lng REAL NOT NULL, pw TEXT NOT NULL, UNIQUE(nombre, direccion));
CREATE TABLE IF NOT EXISTS servicios(id INTEGER PRIMARY KEY AUTOINCREMENT, negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL COLLATE NOCASE, descripcion TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
  duracion_min INTEGER NOT NULL CHECK(duracion_min BETWEEN 5 AND 480), costo REAL NOT NULL CHECK(costo >= 0), UNIQUE(negocio_id, nombre, descripcion));
CREATE TABLE IF NOT EXISTS horario(negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE, dia INTEGER NOT NULL CHECK(dia BETWEEN 0 AND 6),
  abierto INTEGER NOT NULL, inicio TEXT NOT NULL, fin TEXT NOT NULL, PRIMARY KEY(negocio_id, dia));
CREATE TABLE IF NOT EXISTS citas(id INTEGER PRIMARY KEY AUTOINCREMENT, negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL COLLATE NOCASE, servicio_id INTEGER NOT NULL REFERENCES servicios(id) ON DELETE CASCADE, horario TEXT NOT NULL,
  duracion_min INTEGER NOT NULL, creada TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(nombre, servicio_id, horario), UNIQUE(negocio_id, horario));`);

const SECRET = process.env.SECRET_KEY || db.prepare("SELECT v FROM meta WHERE k='secret'").get()?.v || (() => {
  const v = crypto.randomBytes(32).toString('hex'); db.prepare("INSERT INTO meta VALUES('secret',?)").run(v); return v; })();

class Err extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const p = n => String(n).padStart(2, '0');
const ahora = () => { const d = new Date(); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const hm = t => { const [h, m] = t.split(':'); return h * 60 + +m; };
const fechaOk = f => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f); if (!m) return false; const d = new Date(+m[1], m[2] - 1, +m[3]); return d.getMonth() === m[2] - 1 && d.getDate() === +m[3]; };
const slots = (nid, dur, f, paso = dur) => {
  const o = [];
  if (!fechaOk(f)) return o;
  const [y, mo, d] = f.split('-').map(Number);
  const h = db.prepare('SELECT * FROM horario WHERE negocio_id=? AND dia=?').get(nid, new Date(y, mo - 1, d).getDay());
  if (!h?.abierto) return o;
  for (let m = hm(h.inicio); m + dur <= hm(h.fin); m += paso) o.push(`${f} ${p((m / 60) | 0)}:${p(m % 60)}`);
  return o;
};
// Un solo prestador por negocio: ninguna cita se empalma con otra del mismo negocio.
const paso = nid => db.prepare('SELECT MIN(duracion_min) m FROM servicios WHERE negocio_id=?').get(nid).m || 30;
const libre = (nid, f, ini, dur) => !db.prepare('SELECT horario, duracion_min FROM citas WHERE negocio_id=? AND horario LIKE ?').all(nid, f + ' %')
  .some(c => { const s = hm(c.horario.slice(11)); return ini < s + c.duracion_min && ini + dur > s; });
const servicio = (nid, id) => db.prepare('SELECT * FROM servicios WHERE id=? AND negocio_id=?').get(id, nid) ?? (() => { throw new Err(404, 'Servicio no existe'); })();

const cubeta = new Map();
const frenado = (k, max, ms) => { const [n, t0] = cubeta.get(k) ?? [0, Date.now()]; const r = Date.now() - t0 > ms ? [0, Date.now()] : [n, t0]; cubeta.set(k, [r[0] + 1, r[1]]); return r[0] >= max; };

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false }));
app.use(express.json({ limit: '10kb' }));
app.use((_q, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }); next(); });

// ---- Directorio público y registro de negocios ----
app.get('/api/negocios', (_q, res) => res.json(db.prepare('SELECT id,nombre,categoria,descripcion,direccion,telefono,lat,lng FROM negocios ORDER BY nombre').all()));
app.post('/api/negocios', (req, res) => {
  if (frenado('reg:' + req.ip, 10, 36e5)) throw new Err(429, 'Demasiados registros. Intenta más tarde');
  const b = req.body, t = k => String(b[k] ?? '').trim();
  if (process.env.REGISTRO_CODIGO && t('codigo') !== process.env.REGISTRO_CODIGO) throw new Err(403, 'Código de registro incorrecto');
  if (t('nombre').length < 2 || t('nombre').length > 80 || !CATEGORIAS.includes(t('categoria'))) throw new Err(400, 'Revisa el nombre y la categoría');
  if (typeof b.lat !== 'number' || typeof b.lng !== 'number' || Math.abs(b.lat) > 90 || Math.abs(b.lng) > 180) throw new Err(400, 'Indica la ubicación del negocio');
  if (String(b.password ?? '').length < 10) throw new Err(400, 'La contraseña debe tener al menos 10 caracteres');
  try {
    const id = Number(db.prepare('INSERT INTO negocios(nombre,categoria,descripcion,direccion,telefono,lat,lng,pw) VALUES(?,?,?,?,?,?,?,?)')
      .run(t('nombre'), t('categoria'), t('descripcion').slice(0, 300), t('direccion').slice(0, 150), t('telefono').slice(0, 30), b.lat, b.lng, hashPw(String(b.password))).lastInsertRowid);
    for (let d = 0; d < 7; d++) db.prepare('INSERT INTO horario VALUES(?,?,?,?,?)').run(id, d, d > 0 && d < 6 ? 1 : 0, '09:00', '18:00'); // lun-vie por defecto
    res.status(201).json({ id });
  } catch (e) { throw /UNIQUE/.test(e.message) ? new Err(409, 'Ya existe un negocio con ese nombre y dirección') : e; }
});

// ---- Todo lo de un negocio: /api/negocios/:nid/... ----
const r = express.Router({ mergeParams: true });
app.use('/api/negocios/:nid', r);
r.use((req, _res, next) => { const n = db.prepare('SELECT * FROM negocios WHERE id=?').get(req.params.nid); n ? (req.neg = n, next()) : next(new Err(404, 'Negocio no existe')); });
const auth = (req, _res, next) => validToken(req.get('X-Admin-Token'), SECRET) === req.neg.id ? next() : next(new Err(401, 'Sesión no válida. Inicia sesión de nuevo'));

r.post('/login', (req, res) => {
  const k = `login:${req.ip}:${req.neg.id}`;
  if (frenado(k, 5, 9e5)) throw new Err(429, 'Demasiados intentos. Espera 15 minutos');
  if (!checkPw(String(req.body.password ?? ''), req.neg.pw)) throw new Err(401, 'Contraseña incorrecta');
  cubeta.delete(k);
  res.json({ token: makeToken(req.neg.id, SECRET) });
});
r.get('/servicios', (req, res) => res.json(db.prepare('SELECT * FROM servicios WHERE negocio_id=? ORDER BY nombre').all(req.neg.id)));
r.post('/servicios', auth, (req, res) => {
  const n = String(req.body.nombre ?? '').trim(), dur = Number(req.body.duracion_min), costo = Number(req.body.costo);
  if (!n || n.length > 80 || !(dur >= 5 && dur <= 480) || !(costo >= 0)) throw new Err(400, 'Revisa nombre, duración y precio');
  try { res.status(201).json({ id: Number(db.prepare('INSERT INTO servicios(negocio_id,nombre,descripcion,duracion_min,costo) VALUES(?,?,?,?,?)').run(req.neg.id, n, String(req.body.descripcion ?? '').trim().slice(0, 300), dur, costo).lastInsertRowid) }); }
  catch (e) { throw /UNIQUE/.test(e.message) ? new Err(409, 'Ya existe un servicio con el mismo nombre y la misma descripción') : e; }
});
r.delete('/servicios/:id', auth, (req, res) => { db.prepare('DELETE FROM servicios WHERE id=? AND negocio_id=?').run(req.params.id, req.neg.id); res.json({ ok: true }); });
r.get('/horario', (req, res) => res.json(db.prepare('SELECT dia, abierto, inicio, fin FROM horario WHERE negocio_id=? ORDER BY dia').all(req.neg.id)));
r.put('/horario', auth, (req, res) => {
  const rows = req.body.dias, t = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!(Array.isArray(rows) && rows.length === 7 && rows.every(x => Number.isInteger(x.dia) && x.dia >= 0 && x.dia <= 6 && t.test(x.inicio) && t.test(x.fin) && (!x.abierto || hm(x.inicio) < hm(x.fin)))))
    throw new Err(400, 'Revisa los horarios: el cierre debe ser posterior a la apertura');
  const up = db.prepare('UPDATE horario SET abierto=?, inicio=?, fin=? WHERE negocio_id=? AND dia=?');
  for (const x of rows) up.run(x.abierto ? 1 : 0, x.inicio, x.fin, req.neg.id, x.dia);
  res.json({ ok: true });
});
r.get('/disponibilidad', (req, res) => {
  const nid = req.neg.id, s = servicio(nid, req.query.servicio_id), f = String(req.query.fecha ?? '');
  if (!fechaOk(f)) throw new Err(400, 'Parámetros inválidos');
  res.json(slots(nid, s.duracion_min, f, paso(nid)).filter(h => libre(nid, f, hm(h.slice(11)), s.duracion_min) && h > ahora()).map(h => h.slice(11)));
});
r.post('/citas', (req, res) => {
  const nid = req.neg.id, nombre = String(req.body.nombre ?? '').trim(), horario = String(req.body.horario ?? '').trim();
  if (nombre.length < 2 || nombre.length > 80) throw new Err(400, 'Escribe tu nombre (2-80 caracteres)');
  const s = servicio(nid, req.body.servicio_id);
  if (!slots(nid, s.duracion_min, horario.slice(0, 10), paso(nid)).includes(horario) || horario <= ahora()) throw new Err(400, 'Horario no válido');
  if (!libre(nid, horario.slice(0, 10), hm(horario.slice(11)), s.duracion_min)) throw new Err(409, 'Ese horario ya no está disponible. Elige otro');
  try { const x = db.prepare('INSERT INTO citas(negocio_id,nombre,servicio_id,horario,duracion_min) VALUES(?,?,?,?,?)').run(nid, nombre, s.id, horario, s.duracion_min); res.status(201).json({ id: Number(x.lastInsertRowid), servicio: s.nombre, costo: s.costo, horario }); }
  catch (e) { throw /UNIQUE/.test(e.message) ? new Err(409, 'Ese horario ya no está disponible. Elige otro') : e; }
});
r.get('/citas', auth, (req, res) => res.json(db.prepare('SELECT c.id,c.nombre,c.horario,c.duracion_min,s.nombre servicio,s.costo FROM citas c JOIN servicios s ON s.id=c.servicio_id WHERE c.negocio_id=? ORDER BY c.horario').all(req.neg.id)));
r.delete('/citas/:id', auth, (req, res) => { db.prepare('DELETE FROM citas WHERE id=? AND negocio_id=?').run(req.params.id, req.neg.id); res.json({ ok: true }); });

app.use((e, _q, res, _n) => { if (!(e instanceof Err)) console.error(e); res.status(e.code || 500).json({ error: e instanceof Err ? e.message : 'Error interno' }); });
app.listen(process.env.PORT || 3000, () => console.log('API de citas lista'));
