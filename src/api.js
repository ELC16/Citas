import { slots, ahora, hm, DEFAULT_HORARIO } from './slots';
import { tel } from './geo';
const URL_API = import.meta.env.VITE_API_URL || '';
export const DEMO = !URL_API; // sin API configurada: modo demo con localStorage
const sesion = () => { try { return JSON.parse(sessionStorage.getItem('ses')); } catch { return null; } };
let token = sesion()?.token || '';
const guardar = (t, n) => { token = t; try { sessionStorage.setItem('ses', JSON.stringify({ token: t, negocio: { id: n.id, nombre: n.nombre } })); } catch {} return { id: n.id, nombre: n.nombre }; };
const comun = { sesion, salir: () => { token = ''; try { sessionStorage.removeItem('ses'); } catch {} } };

async function http(path, method = 'GET', body) {
  const r = await fetch(URL_API + path, { method, headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token }, body: body && JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}
const N = id => `/api/negocios/${id}`;
const real = {
  ...comun,
  negocios: () => http('/api/negocios'),
  imgUrl: (n, t) => (n['tiene_' + t] ? `${URL_API}${N(n.id)}/imagen/${t}?v=${n.img_v}` : null),
  registrar: b => http('/api/negocios', 'POST', b),
  login: async (email, pw) => { const r = await http('/api/login', 'POST', { email, password: pw }); return guardar(r.token, r.negocio); },
  servicios: nid => http(`${N(nid)}/servicios`),
  horario: nid => http(`${N(nid)}/horario`),
  setHorario: (nid, dias) => http(`${N(nid)}/horario`, 'PUT', { dias }),
  disponibilidad: (nid, sid, f) => http(`${N(nid)}/disponibilidad?servicio_id=${sid}&fecha=${f}`),
  crearCita: (nid, b) => http(`${N(nid)}/citas`, 'POST', b),
  addServicio: (nid, b) => http(`${N(nid)}/servicios`, 'POST', b),
  delServicio: (nid, id) => http(`${N(nid)}/servicios/${id}`, 'DELETE'),
  citas: nid => http(`${N(nid)}/citas`),
  delCita: (nid, id) => http(`${N(nid)}/citas/${id}`, 'DELETE'),
  subirImagen: (nid, t, data) => http(`${N(nid)}/imagen/${t}`, 'PUT', { data }),
  quitarImagen: (nid, t) => http(`${N(nid)}/imagen/${t}`, 'DELETE'),
  whatsapp: nid => http(`${N(nid)}/whatsapp`),
  setWhatsapp: (nid, b) => http(`${N(nid)}/whatsapp`, 'PUT', b),
  delWhatsapp: nid => http(`${N(nid)}/whatsapp`, 'DELETE'),
};

// ---- Modo demo: datos de ejemplo en localStorage (no es seguro, no envía WhatsApp ni se comparte) ----
const SEED = [ // [nombre, correo, categoría, descripción, dirección, lat, lng, servicios]
  ['Estética Luna', 'luna@demo.com', 'Belleza y peluquería', 'Cortes, tintes y peinados', 'Av. Hidalgo 45, Centro', 19.6450, -99.1700, [['Corte de cabello', 'Dama', 45, 250], ['Tinte', 'Cabello corto', 90, 600]]],
  ['Barbería El Patrón', 'patron@demo.com', 'Barbería', 'Corte clásico y barba', 'Calle Reforma 120', 19.6300, -99.1000, [['Corte clásico', 'Caballero', 30, 150], ['Barba', 'Perfilado con toalla caliente', 30, 120]]],
  ['Dental Sonrisa', 'sonrisa@demo.com', 'Dental', 'Consultorio dental familiar', 'Av. Central 300', 19.6000, -99.0500, [['Limpieza dental', 'Profilaxis', 45, 500], ['Consulta de valoración', '', 30, 300]]],
  ['Patitas Spa Canino', 'patitas@demo.com', 'Mascotas', 'Baño y estética para perros', 'Calle Morelos 78', 19.5400, -99.1900, [['Baño y corte', 'Perro mediano', 60, 350]]],
];
const K = 'citas_demo3';
const seed = () => { const d = { n: [], s: [], c: [], h: {}, w: {}, id: 1 };
  SEED.forEach(([nombre, email, categoria, descripcion, direccion, lat, lng, sv]) => { const id = d.id++;
    d.n.push({ id, nombre, email, categoria, descripcion, direccion, telefono: '', lat, lng, pw: 'demo1234', logo: null, foto: null }); d.h[id] = DEFAULT_HORARIO;
    sv.forEach(([n, ds, dur, costo]) => d.s.push({ id: d.id++, negocio_id: id, nombre: n, descripcion: ds, duracion_min: dur, costo })); });
  return d; };
const load = () => { try { return JSON.parse(localStorage.getItem(K)) || seed(); } catch { return seed(); } };
const save = d => { try { localStorage.setItem(K, JSON.stringify(d)); } catch { throw new Error('No hay espacio en el navegador para guardar más datos de la demo.'); } };
const fail = m => { throw new Error(m); };
const paso = (d, nid) => { const l = d.s.filter(x => x.negocio_id == nid); return l.length ? Math.min(...l.map(x => x.duracion_min)) : 30; };
const libre = (d, nid, f, ini, dur) => !d.c.some(c => { const s = hm(c.horario.slice(11)); return c.negocio_id == nid && c.horario.startsWith(f + ' ') && ini < s + c.duracion_min && ini + dur > s; });
const demo = {
  ...comun,
  negocios: async () => load().n.map(({ pw, email, ...x }) => x),
  imgUrl: (n, t) => n[t] || null,
  registrar: async b => {
    const d = load(), n = String(b.nombre).trim(), dir = String(b.direccion || '').trim(), em = String(b.email || '').trim().toLowerCase();
    if (n.length < 2 || !b.categoria) fail('Revisa el nombre y la categoría');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) fail('Escribe un correo válido');
    if (typeof b.lat !== 'number' || typeof b.lng !== 'number') fail('Marca la ubicación del negocio');
    if (String(b.password).length < 10) fail('La contraseña debe tener al menos 10 caracteres');
    if (d.n.some(x => x.email === em)) fail('Ya existe una cuenta con ese correo');
    if (d.n.some(x => x.nombre.toLowerCase() === n.toLowerCase() && x.direccion.toLowerCase() === dir.toLowerCase())) fail('Ya existe un negocio con ese nombre y dirección');
    const id = d.id++; d.n.push({ id, nombre: n, email: em, categoria: b.categoria, descripcion: b.descripcion || '', direccion: dir, telefono: b.telefono || '', lat: b.lat, lng: b.lng, pw: b.password, logo: null, foto: null });
    d.h[id] = DEFAULT_HORARIO; save(d); return { id };
  },
  login: async (email, pw) => { const n = load().n.find(x => x.email === String(email).trim().toLowerCase()); if (!n || n.pw !== pw) fail('Correo o contraseña incorrectos'); return guardar('demo', n); },
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
    const d = load(), s = d.s.find(x => x.id == b.servicio_id && x.negocio_id == nid), n = String(b.nombre || '').trim(), celular = tel(b.celular);
    if (!celular) fail('Escribe tu celular a 10 dígitos');
    if (!s) fail('Servicio no existe');
    if (!slots(s.duracion_min, b.horario.slice(0, 10), d.h[nid] || DEFAULT_HORARIO, paso(d, nid)).includes(b.horario) || b.horario <= ahora()) fail('Horario no válido');
    if (!libre(d, nid, b.horario.slice(0, 10), hm(b.horario.slice(11)), s.duracion_min)) fail('Ese horario ya no está disponible. Elige otro');
    d.c.push({ id: d.id++, negocio_id: +nid, nombre: n, celular, wa: 'manual', servicio_id: s.id, horario: b.horario, duracion_min: s.duracion_min }); save(d);
    return { servicio: s.nombre, costo: s.costo, horario: b.horario, whatsapp: false };
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
  subirImagen: async (nid, t, data) => { const d = load(); d.n.find(x => x.id == nid)[t] = data; save(d); },
  quitarImagen: async (nid, t) => { const d = load(); d.n.find(x => x.id == nid)[t] = null; save(d); },
  whatsapp: async nid => { const w = load().w?.[nid]; return w ? { configurado: true, phone_id: w.phone_id, plantilla: w.plantilla, idioma: w.idioma } : { configurado: false }; },
  setWhatsapp: async (nid, b) => { const d = load(); (d.w ||= {})[nid] = { phone_id: b.phone_id, plantilla: b.plantilla, idioma: b.idioma }; save(d); },
  delWhatsapp: async nid => { const d = load(); delete d.w?.[nid]; save(d); },
};
export const api = DEMO ? demo : real;
