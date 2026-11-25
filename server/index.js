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
  lat REAL NOT NULL, lng REAL NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, pw TEXT NOT NULL,
  logo BLOB, foto BLOB, img_v INTEGER NOT NULL DEFAULT 0, UNIQUE(nombre, direccion));
CREATE TABLE IF NOT EXISTS servicios(id INTEGER PRIMARY KEY AUTOINCREMENT, negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL COLLATE NOCASE, descripcion TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
  duracion_min INTEGER NOT NULL CHECK(duracion_min BETWEEN 5 AND 480), costo REAL NOT NULL CHECK(costo >= 0), UNIQUE(negocio_id, nombre, descripcion));
CREATE TABLE IF NOT EXISTS horario(negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE, dia INTEGER NOT NULL CHECK(dia BETWEEN 0 AND 6),
  abierto INTEGER NOT NULL, inicio TEXT NOT NULL, fin TEXT NOT NULL, PRIMARY KEY(negocio_id, dia));
CREATE TABLE IF NOT EXISTS citas(id INTEGER PRIMARY KEY AUTOINCREMENT, negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL COLLATE NOCASE, servicio_id INTEGER NOT NULL REFERENCES servicios(id) ON DELETE CASCADE, horario TEXT NOT NULL,
  duracion_min INTEGER NOT NULL, celular TEXT NOT NULL DEFAULT '', wa TEXT NOT NULL DEFAULT 'manual', creada TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(nombre, servicio_id, horario), UNIQUE(negocio_id, horario));
CREATE TABLE IF NOT EXISTS whatsapp(negocio_id INTEGER PRIMARY KEY REFERENCES negocios(id) ON DELETE CASCADE,
  phone_id TEXT NOT NULL, token TEXT NOT NULL, plantilla TEXT NOT NULL, idioma TEXT NOT NULL DEFAULT 'es_MX');`);

const SECRET = process.env.SECRET_KEY || db.prepare("SELECT v FROM meta WHERE k='secret'").get()?.v || (() => {
  const v = crypto.randomBytes(32).toString('hex'); db.prepare("INSERT INTO meta VALUES('secret',?)").run(v); return v; })();

// ---- Utilidades: token de WhatsApp cifrado, celulares, imágenes y envío de confirmaciones ----
const KEY = crypto.createHash('sha256').update(SECRET).digest();
const enc = t => { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', KEY, iv), b = Buffer.concat([c.update(t, 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), b]).toString('base64'); };
const dec = s => { const b = Buffer.from(s, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', KEY, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); };
const tel = t => { const d = String(t ?? '').replace(/\D/g, ''); return d.length === 10 ? (process.env.PAIS_DEFAULT || '52') + d : /^\d{11,15}$/.test(d) ? d : ''; };
const tipoImg = b => b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : b.subarray(0, 4).toString('latin1') === '\x89PNG' ? 'image/png' : b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' ? 'image/webp' : null;
async function enviarWA(neg, c, servicio) { // mensaje de plantilla desde el número de WhatsApp Business del negocio (Cloud API de Meta)
  const w = db.prepare('SELECT * FROM whatsapp WHERE negocio_id=?').get(neg.id);
  let est = 'error';
  try {
    const cuando = `${c.horario.slice(8, 10)}/${c.horario.slice(5, 7)}/${c.horario.slice(0, 4)} a las ${c.horario.slice(11)}`;
    const r = await fetch(`https://graph.facebook.com/${process.env.GRAPH_VERSION || 'v21.0'}/${w.phone_id}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${dec(w.token)}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ messaging_product: 'whatsapp', to: c.celular, type: 'template', template: { name: w.plantilla, language: { code: w.idioma },
        components: [{ type: 'body', parameters: [c.nombre || 'cliente', servicio, cuando, neg.nombre].map(text => ({ type: 'text', text })) }] } }) });
    if (r.ok) est = 'enviado'; else console.error('WhatsApp HTTP', r.status);
  } catch (e) { console.error('WhatsApp', e.message); }
  db.prepare('UPDATE citas SET wa=? WHERE id=?').run(est, c.id);
}

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
const chico = express.json({ limit: '10kb' }), grande = express.json({ limit: '500kb' });
app.use((req, res, next) => (req.method === 'PUT' && /\/imagen\//.test(req.path) ? grande : chico)(req, res, next));
app.use((_q, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }); next(); });

// ---- Directorio público y registro de negocios ----
app.get('/api/negocios', (_q, res) => res.json(db.prepare('SELECT id,nombre,categoria,descripcion,direccion,telefono,lat,lng,(logo IS NOT NULL) tiene_logo,(foto IS NOT NULL) tiene_foto,img_v FROM negocios ORDER BY nombre').all()));
app.post('/api/negocios', (req, res) => {
  if (frenado('reg:' + req.ip, 10, 36e5)) throw new Err(429, 'Demasiados registros. Intenta más tarde');
  const b = req.body, t = k => String(b[k] ?? '').trim();
  if (process.env.REGISTRO_CODIGO && t('codigo') !== process.env.REGISTRO_CODIGO) throw new Err(403, 'Código de registro incorrecto');
  if (t('nombre').length < 2 || t('nombre').length > 80 || !CATEGORIAS.includes(t('categoria'))) throw new Err(400, 'Revisa el nombre y la categoría');
  if (typeof b.lat !== 'number' || typeof b.lng !== 'number' || Math.abs(b.lat) > 90 || Math.abs(b.lng) > 180) throw new Err(400, 'Indica la ubicación del negocio');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t('email')) || t('email').length > 120) throw new Err(400, 'Escribe un correo válido');
  if (String(b.password ?? '').length < 10) throw new Err(400, 'La contraseña debe tener al menos 10 caracteres');
  try {
    const id = Number(db.prepare('INSERT INTO negocios(nombre,categoria,descripcion,direccion,telefono,lat,lng,email,pw) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(t('nombre'), t('categoria'), t('descripcion').slice(0, 300), t('direccion').slice(0, 150), t('telefono').slice(0, 30), b.lat, b.lng, t('email').toLowerCase(), hashPw(String(b.password))).lastInsertRowid);
    for (let d = 0; d < 7; d++) db.prepare('INSERT INTO horario VALUES(?,?,?,?,?)').run(id, d, d > 0 && d < 6 ? 1 : 0, '09:00', '18:00'); // lun-vie por defecto
    res.status(201).json({ id });
  } catch (e) { throw /UNIQUE/.test(e.message) ? new Err(409, /email/.test(e.message) ? 'Ya existe una cuenta con ese correo' : 'Ya existe un negocio con ese nombre y dirección') : e; }
});
app.post('/api/login', (req, res) => { // el negocio entra con su correo y contraseña
  const email = String(req.body.email ?? '').trim().toLowerCase(), k = `login:${req.ip}:${email}`;
  if (frenado(k, 5, 9e5)) throw new Err(429, 'Demasiados intentos. Espera 15 minutos');
  const n = db.prepare('SELECT id,nombre,pw FROM negocios WHERE email=?').get(email);
  if (!n || !checkPw(String(req.body.password ?? ''), n.pw)) throw new Err(401, 'Correo o contraseña incorrectos');
  cubeta.delete(k);
  res.json({ token: makeToken(n.id, SECRET), negocio: { id: n.id, nombre: n.nombre } });
});

// ---- Todo lo de un negocio: /api/negocios/:nid/... ----
const r = express.Router({ mergeParams: true });
app.use('/api/negocios/:nid', r);
r.use((req, _res, next) => { const n = db.prepare('SELECT id,nombre FROM negocios WHERE id=?').get(req.params.nid); n ? (req.neg = n, next()) : next(new Err(404, 'Negocio no existe')); });
const auth = (req, _res, next) => validToken(req.get('X-Admin-Token'), SECRET) === req.neg.id ? next() : next(new Err(401, 'Sesión no válida. Inicia sesión de nuevo'));

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
  const nid = req.neg.id, nombre = String(req.body.nombre ?? '').trim(), horario = String(req.body.horario ?? '').trim(), celular = tel(req.body.celular);
  if (frenado('cita:' + req.ip, 20, 36e5)) throw new Err(429, 'Demasiadas reservas desde tu conexión. Intenta más tarde');
  if (!celular) throw new Err(400, 'Escribe tu celular a 10 dígitos');
  if (nombre.length > 80) throw new Err(400, 'El nombre es demasiado largo');
  const s = servicio(nid, req.body.servicio_id);
  if (!slots(nid, s.duracion_min, horario.slice(0, 10), paso(nid)).includes(horario) || horario <= ahora()) throw new Err(400, 'Horario no válido');
  if (!libre(nid, horario.slice(0, 10), hm(horario.slice(11)), s.duracion_min)) throw new Err(409, 'Ese horario ya no está disponible. Elige otro');
  try {
    const auto = !!db.prepare('SELECT 1 FROM whatsapp WHERE negocio_id=?').get(nid);
    const x = db.prepare('INSERT INTO citas(negocio_id,nombre,servicio_id,horario,duracion_min,celular,wa) VALUES(?,?,?,?,?,?,?)').run(nid, nombre, s.id, horario, s.duracion_min, celular, auto ? 'pendiente' : 'manual');
    res.status(201).json({ id: Number(x.lastInsertRowid), servicio: s.nombre, costo: s.costo, horario, whatsapp: auto });
    if (auto) enviarWA(req.neg, { id: Number(x.lastInsertRowid), nombre, horario, celular }, s.nombre); // no bloquea la respuesta
  }
  catch (e) { throw /UNIQUE/.test(e.message) ? new Err(409, 'Ese horario ya no está disponible. Elige otro') : e; }
});
r.get('/citas', auth, (req, res) => res.json(db.prepare('SELECT c.id,c.nombre,c.horario,c.duracion_min,c.celular,c.wa,s.nombre servicio,s.costo FROM citas c JOIN servicios s ON s.id=c.servicio_id WHERE c.negocio_id=? ORDER BY c.horario').all(req.neg.id)));
r.delete('/citas/:id', auth, (req, res) => { db.prepare('DELETE FROM citas WHERE id=? AND negocio_id=?').run(req.params.id, req.neg.id); res.json({ ok: true }); });

// ---- Logo y foto del banner (se guardan redimensionados desde el navegador) ----
r.get('/imagen/:tipo', (req, res) => {
  const t = req.params.tipo;
  if (!['logo', 'foto'].includes(t)) throw new Err(404, 'No encontrado');
  const b = db.prepare(`SELECT ${t} AS img FROM negocios WHERE id=?`).get(req.neg.id).img;
  if (!b) throw new Err(404, 'Sin imagen');
  res.set({ 'Content-Type': tipoImg(b) || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400', 'Content-Security-Policy': "default-src 'none'" }).send(Buffer.from(b));
});
r.put('/imagen/:tipo', auth, (req, res) => {
  const t = req.params.tipo;
  if (!['logo', 'foto'].includes(t)) throw new Err(404, 'No encontrado');
  const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.data ?? '')), buf = m && Buffer.from(m[1], 'base64');
  if (!buf || !tipoImg(buf)) throw new Err(400, 'Imagen no válida (usa JPG, PNG o WebP)');
  if (buf.length > (t === 'logo' ? 60e3 : 300e3)) throw new Err(413, 'La imagen es demasiado pesada');
  db.prepare(`UPDATE negocios SET ${t}=?, img_v=img_v+1 WHERE id=?`).run(buf, req.neg.id);
  res.json({ ok: true });
});
r.delete('/imagen/:tipo', auth, (req, res) => {
  if (!['logo', 'foto'].includes(req.params.tipo)) throw new Err(404, 'No encontrado');
  db.prepare(`UPDATE negocios SET ${req.params.tipo}=NULL, img_v=img_v+1 WHERE id=?`).run(req.neg.id);
  res.json({ ok: true });
});
// ---- Datos de WhatsApp Business (Cloud API) del negocio; el token se guarda cifrado y nunca se devuelve ----
r.get('/whatsapp', auth, (req, res) => { const w = db.prepare('SELECT phone_id, plantilla, idioma FROM whatsapp WHERE negocio_id=?').get(req.neg.id); res.json(w ? { configurado: true, ...w } : { configurado: false }); });
r.put('/whatsapp', auth, (req, res) => {
  const b = req.body, t = k => String(b[k] ?? '').trim(), prev = db.prepare('SELECT token FROM whatsapp WHERE negocio_id=?').get(req.neg.id), idioma = t('idioma') || 'es_MX';
  if (!/^\d{5,20}$/.test(t('phone_id')) || !/^[a-z0-9_]{1,100}$/.test(t('plantilla')) || !/^[a-z]{2,3}(_[A-Z]{2})?$/.test(idioma) || !(t('token') || prev))
    throw new Err(400, 'Revisa el ID del número, el token, el nombre de la plantilla y el idioma');
  db.prepare('INSERT INTO whatsapp VALUES(?,?,?,?,?) ON CONFLICT(negocio_id) DO UPDATE SET phone_id=excluded.phone_id, token=excluded.token, plantilla=excluded.plantilla, idioma=excluded.idioma')
    .run(req.neg.id, t('phone_id'), t('token') ? enc(t('token')) : prev.token, t('plantilla'), idioma);
  res.json({ ok: true });
});
r.delete('/whatsapp', auth, (req, res) => { db.prepare('DELETE FROM whatsapp WHERE negocio_id=?').run(req.neg.id); res.json({ ok: true }); });

app.use((e, _q, res, _n) => {
  const code = e.code > 0 ? e.code : e.status || 500;
  if (!(e instanceof Err) && code >= 500) console.error(e);
  res.status(code).json({ error: e instanceof Err ? e.message : code >= 500 ? 'Error interno' : 'Solicitud no válida' });
});
app.listen(process.env.PORT || 3000, () => console.log('API de citas lista'));
