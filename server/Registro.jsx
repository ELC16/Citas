import { useState } from 'react';
import { api } from '../api';
import { CATEGORIAS, parseCoords, ubicar } from '../geo';
const inp = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-800';
const Campo = ({ label, hint, children }) => (<label className="block"><span className="text-sm font-medium">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}</label>);
const vacio = { nombre: '', categoria: '', descripcion: '', direccion: '', telefono: '', coords: '', password: '', password2: '', codigo: '' };

export default function Registro() {
  const [f, setF] = useState(vacio);
  const [msg, setMsg] = useState(null);
  const [id, setId] = useState(null);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const aqui = () => ubicar().then(p => setF({ ...f, coords: `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` })).catch(e => setMsg({ e: 1, t: e.message }));
  const enviar = async () => {
    const c = parseCoords(f.coords);
    if (!c) return setMsg({ e: 1, t: 'Indica la ubicación con el botón o pega las coordenadas (ej. 19.6450, -99.1700).' });
    if (f.password !== f.password2) return setMsg({ e: 1, t: 'Las contraseñas no coinciden.' });
    try { const r = await api.registrar({ ...f, ...c }); setId(r.id); setMsg(null); } catch (e) { setMsg({ e: 1, t: e.message }); }
  };
  if (id) return (<section className="rounded-2xl bg-white p-5 shadow dark:bg-slate-800"><h1 className="mb-2 text-xl font-semibold">¡Negocio registrado!</h1>
    <p className="mb-3 text-sm">Ya aparece en el buscador. Entra a tu panel para agregar tus servicios, precios y horario.</p>
    <a className="inline-block rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white" href={`#/admin/${id}`}>Ir a mi panel</a></section>);
  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow dark:bg-slate-800">
      <h1 className="text-2xl font-semibold">Registra tu negocio</h1>
      <Campo label="Nombre del negocio"><input className={inp} maxLength={80} placeholder="Ej. Estética Luna" value={f.nombre} onChange={set('nombre')} /></Campo>
      <Campo label="Categoría"><select className={inp} value={f.categoria} onChange={set('categoria')}><option value="">Elige una categoría</option>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select></Campo>
      <Campo label="Descripción (opcional)"><input className={inp} maxLength={300} placeholder="Ej. Cortes, tintes y peinados" value={f.descripcion} onChange={set('descripcion')} /></Campo>
      <Campo label="Dirección"><input className={inp} maxLength={150} placeholder="Calle, número y colonia" value={f.direccion} onChange={set('direccion')} /></Campo>
      <Campo label="Teléfono (opcional)"><input className={inp} type="tel" maxLength={30} value={f.telefono} onChange={set('telefono')} /></Campo>
      <Campo label="Ubicación en el mapa" hint="Sirve para que te encuentren por distancia. Si no estás en el negocio, en Google Maps mantén presionado el lugar, copia las coordenadas y pégalas aquí.">
        <button type="button" onClick={aqui} className="mt-1 w-full rounded-lg border border-blue-600 p-2.5 font-medium text-blue-600 dark:text-blue-400">📍 Usar mi ubicación actual</button>
        <input className={inp} placeholder="Ej. 19.6450, -99.1700" value={f.coords} onChange={set('coords')} /></Campo>
      <Campo label="Contraseña de tu panel" hint="Mínimo 10 caracteres."><input className={inp} type="password" value={f.password} onChange={set('password')} /></Campo>
      <Campo label="Repite la contraseña"><input className={inp} type="password" value={f.password2} onChange={set('password2')} /></Campo>
      <Campo label="Código de registro (solo si te lo dieron)"><input className={inp} value={f.codigo} onChange={set('codigo')} /></Campo>
      <button onClick={enviar} className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white">Registrar negocio</button>
      {msg && <p className="text-red-600">{msg.t}</p>}
    </section>
  );
}
