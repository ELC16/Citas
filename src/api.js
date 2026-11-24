import { slots, ahora, hm, DEFAULT_HORARIO } from './slots';
const URL_API = import.meta.env.VITE_API_URL || '';
export const DEMO = !URL_API; // sin API configurada: modo demo con localStorage
let token = '';

async function http(path, method = 'GET', body) {
  const r = await fetch(URL_API + path, { method, headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token }, body: body && JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}
const real = {
  servicios: () => http('/api/servicios'),
  horario: () => http('/api/horario'),
  setHorario: dias => http('/api/horario', 'PUT', { dias }),
  disponibilidad: (sid, f) => http(`/api/disponibilidad?servicio_id=${sid}&fecha=${f}`),
  crearCita: b => http('/api/citas', 'POST', b),
  login: async pw => { token = (await http('/api/login', 'POST', { password: pw })).token; },
  addServicio: b => http('/api/servicios', 'POST', b),
  delServicio: id => http(`/api/servicios/${id}`, 'DELETE'),
  citas: () => http('/api/citas'),
  delCita: id => http(`/api/citas/${id}`, 'DELETE'),
};

// ---- Modo demo (solo para probar; no es seguro ni compartido) ----
const K = 'citas_demo';
const vacio = () => ({ s: [], c: [], id: 1, h: DEFAULT_HORARIO });
const load = () => { try { return { ...vacio(), ...JSON.parse(localStorage.getItem(K)) }; } catch { return vacio(); } };
const save = d => localStorage.setItem(K, JSON.stringify(d));
const fail = m => { throw new Error(m); };
// Un solo prestador: ninguna cita puede empalmarse con otra, sea del servicio que sea.
const paso = d => (d.s.length ? Math.min(...d.s.map(x => x.duracion_min)) : 30);
const libre = (d, f, ini, dur) => !d.c.some(c => { const s = hm(c.horario.slice(11)); return c.horario.startsWith(f + ' ') && ini < s + (c.duracion_min || 60) && ini + dur > s; });
const demo = {
  servicios: async () => load().s,
  horario: async () => load().h,
  setHorario: async dias => {
    if (dias.some(r => r.abierto && r.inicio >= r.fin)) fail('Revisa los horarios: el cierre debe ser posterior a la apertura');
    const d = load(); d.h = dias; save(d);
  },
  disponibilidad: async (sid, f) => {
    const d = load(), s = d.s.find(x => x.id == sid) || fail('Servicio no existe');
    return slots(s.duracion_min, f, d.h, paso(d)).filter(h => libre(d, f, hm(h.slice(11)), s.duracion_min) && h > ahora()).map(h => h.slice(11));
  },
  crearCita: async b => {
    const d = load(), s = d.s.find(x => x.id == b.servicio_id), n = b.nombre.trim();
    if (n.length < 2) fail('Escribe tu nombre (2-80 caracteres)');
    if (!s) fail('Servicio no existe');
    if (!slots(s.duracion_min, b.horario.slice(0, 10), d.h, paso(d)).includes(b.horario) || b.horario <= ahora()) fail('Horario no válido');
    if (!libre(d, b.horario.slice(0, 10), hm(b.horario.slice(11)), s.duracion_min)) fail('Ese horario ya no está disponible. Elige otro');
    d.c.push({ id: d.id++, nombre: n, servicio_id: s.id, horario: b.horario, duracion_min: s.duracion_min }); save(d);
    return { servicio: s.nombre, costo: s.costo, horario: b.horario };
  },
  login: async pw => { if (pw !== 'demo1234') fail('Contraseña incorrecta'); },
  addServicio: async b => {
    const d = load(), n = String(b.nombre).trim(), ds = String(b.descripcion || '').trim(), dur = +b.duracion_min, costo = +b.costo;
    if (!n || !(dur >= 5 && dur <= 480) || !(costo >= 0)) fail('Revisa nombre, duración y precio');
    if (d.s.some(x => x.nombre.toLowerCase() === n.toLowerCase() && x.descripcion.toLowerCase() === ds.toLowerCase())) fail('Ya existe un servicio con el mismo nombre y la misma descripción');
    d.s.push({ id: d.id++, nombre: n, descripcion: ds, duracion_min: dur, costo }); save(d);
  },
  delServicio: async id => { const d = load(); d.s = d.s.filter(x => x.id != id); d.c = d.c.filter(x => x.servicio_id != id); save(d); },
  citas: async () => { const d = load(); return d.c.map(c => { const s = d.s.find(s => s.id == c.servicio_id); return { ...c, servicio: s?.nombre, costo: s?.costo ?? 0 }; }).sort((a, b) => a.horario.localeCompare(b.horario)); },
  delCita: async id => { const d = load(); d.c = d.c.filter(x => x.id != id); save(d); },
};
export const api = DEMO ? demo : real;
