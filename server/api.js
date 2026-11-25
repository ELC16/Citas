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
const N = id => `/api/negocios/${id}`;
const real = {
  negocios: () => http('/api/negocios'),
  registrar: b => http('/api/negocios', 'POST', b),
  login: async (nid, pw) => { token = (await http(`${N(nid)}/login`, 'POST', { password: pw })).token; },
  servicios: nid => http(`${N(nid)}/servicios`),
  horario: nid => http(`${N(nid)}/horario`),
  setHorario: (nid, dias) => http(`${N(nid)}/horario`, 'PUT', { dias }),
  disponibilidad: (nid, sid, f) => http(`${N(nid)}/disponibilidad?servicio_id=${sid}&fecha=${f}`),
  crearCita: (nid, b) => http(`${N(nid)}/citas`, 'POST', b),
  addServicio: (nid, b) => http(`${N(nid)}/servicios`, 'POST', b),
  delServicio: (nid, id) => http(`${N(nid)}/servicios/${id}`, 'DELETE'),
  citas: nid => http(`${N(nid)}/citas`),
  delCita: (nid, id) => http(`${N(nid)}/citas/${id}`, 'DELETE'),
};

// ---- Modo demo: datos de ejemplo en localStorage (no es seguro ni compartido) ----
const SEED = [ // [nombre, categoría, descripción, dirección, lat, lng, [[servicio, descripción, min, precio]]]
  ['Estética Luna', 'Belleza y peluquería', 'Cortes, tintes y peinados', 'Av. Hidalgo 45, Centro', 19.6450, -99.1700, [['Corte de cabello', 'Dama', 45, 250], ['Tinte', 'Cabello corto', 90, 600]]],
  ['Barbería El Patrón', 'Barbería', 'Corte clásico y barba', 'Calle Reforma 120', 19.6300, -99.1000, [['Corte clásico', 'Caballero', 30, 150], ['Barba', 'Perfilado con toalla caliente', 30, 120]]],
  ['Dental Sonrisa', 'Dental', 'Consultorio dental familiar', 'Av. Central 300', 19.6000, -99.0500, [['Limpieza dental', 'Profilaxis', 45, 500], ['Consulta de valoración', '', 30, 300]]],
  ['Patitas Spa Canino', 'Mascotas', 'Baño y estética para perros', 'Calle Morelos 78', 19.5400, -99.1900, [['Baño y corte', 'Perro mediano', 60, 350]]],
];
const K = 'citas_demo2';
const seed = () => { const d = { n: [], s: [], c: [], h: {}, id: 1 };
  SEED.forEach(([nombre, categoria, descripcion, direccion, lat, lng, sv]) => { const id = d.id++;
    d.n.push({ id, nombre, categoria, descripcion, direccion, telefono: '', lat, lng, pw: 'demo1234' }); d.h[id] = DEFAULT_HORARIO;
    sv.forEach(([n, ds, dur, costo]) => d.s.push({ id: d.id++, negocio_id: id, nombre: n, descripcion: ds, duracion_min: dur, costo })); });
  return d; };
const load = () => { try { return JSON.parse(localStorage.getItem(K)) || seed(); } catch { return seed(); } };
const save = d => localStorage.setItem(K, JSON.stringify(d));
const fail = m => { throw new Error(m); };
const neg = (d, nid) => d.n.find(x => x.id == nid) || fail('Negocio no existe');
const paso = (d, nid) => { const l = d.s.filter(x => x.negocio_id == nid); return l.length ? Math.min(...l.map(x => x.duracion_min)) : 30; };
const libre = (d, nid, f, ini, dur) => !d.c.some(c => { const s = hm(c.horario.slice(11)); return c.negocio_id == nid && c.horario.startsWith(f + ' ') && ini < s + c.duracion_min && ini + dur > s; });
const demo = {
  negocios: async () => load().n.map(({ pw, ...x }) => x),
  registrar: async b => {
    const d = load(), n = String(b.nombre).trim(), dir = String(b.direccion || '').trim();
    if (n.length < 2 || !b.categoria) fail('Revisa el nombre y la categoría');
    if (typeof b.lat !== 'number' || typeof b.lng !== 'number') fail('Indica la ubicación del negocio');
    if (String(b.password).length < 10) fail('La contraseña debe tener al menos 10 caracteres');
    if (d.n.some(x => x.nombre.toLowerCase() === n.toLowerCase() && x.direccion.toLowerCase() === dir.toLowerCase())) fail('Ya existe un negocio con ese nombre y dirección');
    const id = d.id++; d.n.push({ id, nombre: n, categoria: b.categoria, descripcion: b.descripcion || '', direccion: dir, telefono: b.telefono || '', lat: b.lat, lng: b.lng, pw: b.password });
    d.h[id] = DEFAULT_HORARIO; save(d); return { id };
  },
  login: async (nid, pw) => { if (neg(load(), nid).pw !== pw) fail('Contraseña incorrecta'); },
  servicios: async nid => load().s.filter(s => s.negocio_id == nid),
  horario: async nid => load().h[nid] || DEFAULT_HORARIO,
  setHorario: async (nid, dias) => {
    if (dias.some(r => r.abierto && r.inicio >= r.fin)) fail('Revisa los horarios: el cierre debe ser posterior a la apertura');
    const d = load(); d.h[nid] = dias; save(d);
  },
  disponibilidad: async (nid, sid, f) => {
    const d = load(), s = d.s.find(x => x.id == sid && x.negocio_id == nid) || fail('Servicio no existe');
    return slots(s.duracion_min, f, d.h[nid] || DEFAULT_HORARIO, paso(d, nid)).filter(h => libre(d, nid, f, hm(h.slice(11)), s.duracion_min) && h > ahora()).map(h => h.slice(11));
  },
  crearCita: async (nid, b) => {
    const d = load(), s = d.s.find(x => x.id == b.servicio_id && x.negocio_id == nid), n = b.nombre.trim();
    if (n.length < 2) fail('Escribe tu nombre (2-80 caracteres)');
    if (!s) fail('Servicio no existe');
    if (!slots(s.duracion_min, b.horario.slice(0, 10), d.h[nid] || DEFAULT_HORARIO, paso(d, nid)).includes(b.horario) || b.horario <= ahora()) fail('Horario no válido');
    if (!libre(d, nid, b.horario.slice(0, 10), hm(b.horario.slice(11)), s.duracion_min)) fail('Ese horario ya no está disponible. Elige otro');
    d.c.push({ id: d.id++, negocio_id: +nid, nombre: n, servicio_id: s.id, horario: b.horario, duracion_min: s.duracion_min }); save(d);
    return { servicio: s.nombre, costo: s.costo, horario: b.horario };
  },
  addServicio: async (nid, b) => {
    const d = load(), n = String(b.nombre).trim(), ds = String(b.descripcion || '').trim(), dur = +b.duracion_min, costo = +b.costo;
    if (!n || !(dur >= 5 && dur <= 480) || !(costo >= 0)) fail('Revisa nombre, duración y precio');
    if (d.s.some(x => x.negocio_id == nid && x.nombre.toLowerCase() === n.toLowerCase() && x.descripcion.toLowerCase() === ds.toLowerCase())) fail('Ya existe un servicio con el mismo nombre y la misma descripción');
    d.s.push({ id: d.id++, negocio_id: +nid, nombre: n, descripcion: ds, duracion_min: dur, costo }); save(d);
  },
  delServicio: async (nid, id) => { const d = load(); d.s = d.s.filter(x => x.id != id); d.c = d.c.filter(x => x.servicio_id != id); save(d); },
  citas: async nid => { const d = load(); return d.c.filter(c => c.negocio_id == nid).map(c => { const s = d.s.find(s => s.id == c.servicio_id); return { ...c, servicio: s?.nombre, costo: s?.costo ?? 0 }; }).sort((a, b) => a.horario.localeCompare(b.horario)); },
  delCita: async (nid, id) => { const d = load(); d.c = d.c.filter(x => x.id != id); save(d); },
};
export const api = DEMO ? demo : real;
