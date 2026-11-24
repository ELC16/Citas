import { slots, ahora } from './slots';
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
const load = () => { try { return JSON.parse(localStorage.getItem(K)) || { s: [], c: [], id: 1 }; } catch { return { s: [], c: [], id: 1 }; } };
const save = d => localStorage.setItem(K, JSON.stringify(d));
const fail = m => { throw new Error(m); };
const demo = {
  servicios: async () => load().s,
  disponibilidad: async (sid, f) => {
    const d = load(), s = d.s.find(x => x.id == sid) || fail('Servicio no existe');
    const oc = new Set(d.c.filter(c => c.servicio_id == sid).map(c => c.horario));
    return slots(s.duracion_min, f).filter(h => !oc.has(h) && h > ahora()).map(h => h.slice(11));
  },
  crearCita: async b => {
    const d = load(), s = d.s.find(x => x.id == b.servicio_id), n = b.nombre.trim();
    if (n.length < 2) fail('Escribe tu nombre (2-80 caracteres)');
    if (!s) fail('Servicio no existe');
    if (!slots(s.duracion_min, b.horario.slice(0, 10)).includes(b.horario) || b.horario <= ahora()) fail('Horario no válido');
    if (d.c.some(c => c.servicio_id == s.id && c.horario == b.horario)) fail('Ese horario ya no está disponible para este servicio');
    d.c.push({ id: d.id++, nombre: n, servicio_id: s.id, horario: b.horario }); save(d);
    return { servicio: s.nombre, costo: s.costo, horario: b.horario };
  },
  login: async pw => { if (pw !== 'demo1234') fail('Contraseña incorrecta'); },
  addServicio: async b => {
    const d = load(), n = String(b.nombre).trim(), dur = +b.duracion_min, costo = +b.costo;
    if (!n || !(dur >= 5 && dur <= 480) || !(costo >= 0)) fail('Revisa nombre, duración (5-480 min) y costo');
    if (d.s.some(x => x.nombre.toLowerCase() === n.toLowerCase())) fail('Ya existe un servicio con ese nombre');
    d.s.push({ id: d.id++, nombre: n, descripcion: b.descripcion || '', duracion_min: dur, costo }); save(d);
  },
  delServicio: async id => { const d = load(); d.s = d.s.filter(x => x.id != id); d.c = d.c.filter(x => x.servicio_id != id); save(d); },
  citas: async () => { const d = load(); return d.c.map(c => { const s = d.s.find(s => s.id == c.servicio_id); return { ...c, servicio: s?.nombre, costo: s?.costo ?? 0 }; }).sort((a, b) => a.horario.localeCompare(b.horario)); },
  delCita: async id => { const d = load(); d.c = d.c.filter(x => x.id != id); save(d); },
};
export const api = DEMO ? demo : real;
