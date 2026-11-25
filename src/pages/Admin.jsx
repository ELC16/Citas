import { useEffect, useState } from 'react';
import { api } from '../api';
import Calendario from './Calendario';
import Perfil from './Perfil';
const inp = 'mt-1 w-full rounded-xl border border-violet-200 bg-white p-2.5';
const card = 'mb-4 rounded-3xl bg-white p-5 shadow-md shadow-violet-200/50';
const $ = n => '$' + Number(n).toFixed(2);
const vacio = { nombre: '', descripcion: '', duracion_min: '30', costo: '' };
const DUR = [15, 20, 30, 45, 60, 90, 120, 180];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ORDEN = [1, 2, 3, 4, 5, 6, 0];
const Campo = ({ label, hint, children }) => (
  <label className="block"><span className="text-sm font-medium">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}</label>);

export default function Admin() {
  const ses = api.sesion();
  const [nid, setNid] = useState(ses?.negocio.id || '');
  const [ok, setOk] = useState(!!ses);
  const [tab, setTab] = useState('citas');
  const [cred, setCred] = useState({ email: '', pw: '' });
  const [f, setF] = useState(vacio);
  const [negocios, setNegocios] = useState([]);
  const [sv, setSv] = useState([]);
  const [ct, setCt] = useState([]);
  const [hor, setHor] = useState([]);
  const [msg, setMsg] = useState(null);
  const negocio = negocios.find(n => n.id == nid);
  const run = async (fn, okMsg) => { try { await fn(); setMsg(okMsg ? { t: okMsg } : null); } catch (e) { setMsg({ e: 1, t: e.message }); } };
  const cargarNeg = () => api.negocios().then(setNegocios).catch(() => {});
  const refresh = async (id = nid) => { setSv(await api.servicios(id)); setCt(await api.citas(id)); setHor(await api.horario(id)); };
  const salir = () => { api.salir(); setOk(false); setNid(''); };
  useEffect(() => { cargarNeg(); if (ok) refresh().catch(() => { salir(); setMsg({ e: 1, t: 'Tu sesión expiró. Inicia sesión de nuevo.' }); }); }, []);
  const entrar = () => run(async () => { const r = await api.login(cred.email, cred.pw); setNid(r.id); setCred({ email: '', pw: '' }); await refresh(r.id); setOk(true); });
  const add = () => run(async () => { await api.addServicio(nid, f); setF(vacio); await refresh(); }, 'Servicio agregado');
  const del = (fn, id, q) => confirm(q) && run(async () => { await fn(nid, id); await refresh(); });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const setDia = (dia, k, v) => setHor(hor.map(h => (h.dia === dia ? { ...h, [k]: v } : h)));
  const guardar = () => run(async () => { await api.setHorario(nid, hor.map(h => ({ ...h, abierto: !!h.abierto }))); await refresh(); }, 'Horario guardado');

  return (<>
    {!ok && <div className={card}><h1 className="mb-3 text-xl font-semibold">Entra a tu negocio</h1>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); entrar(); }}>
        <Campo label="Correo electrónico"><input className={inp} type="email" autoComplete="email" value={cred.email} onChange={e => setCred({ ...cred, email: e.target.value })} /></Campo>
        <Campo label="Contraseña"><input className={inp} type="password" autoComplete="current-password" value={cred.pw} onChange={e => setCred({ ...cred, pw: e.target.value })} /></Campo>
        <button className="w-full rounded-xl bg-violet-300 p-2.5 font-semibold text-violet-950">Entrar</button></form>
      <p className="mt-3 text-sm">¿Aún no tienes cuenta? <a className="text-violet-700 underline" href="#/registro">Crea la de tu negocio</a></p></div>}
    {msg && <p className={`mb-3 ${msg.e ? 'text-rose-600' : 'text-emerald-700'}`}>{msg.t}</p>}
    {ok && <>
      <div className="mb-3 flex items-center justify-between gap-2"><h1 className="text-xl font-semibold">{negocio?.nombre || ses?.negocio.nombre}</h1>
        <button className="text-sm text-slate-500 underline" onClick={salir}>Cerrar sesión</button></div>
      <div className="mb-3 flex flex-wrap gap-2">
        {[['citas', 'Calendario de citas'], ['servicios', 'Servicios y precios'], ['horario', 'Horario de atención'], ['perfil', 'Perfil y WhatsApp']].map(([k, t]) =>
          <button key={k} onClick={() => { setTab(k); setMsg(null); }} className={`rounded-xl px-3 py-2 text-sm font-medium ${tab === k ? 'bg-violet-300 text-violet-950' : 'bg-white'}`}>{t}</button>)}
      </div>

      {tab === 'citas' && <div className={card}><Calendario citas={ct} negocio={negocio?.nombre} onDel={id => del(api.delCita, id, '¿Cancelar esta cita?')} /></div>}

      {tab === 'servicios' && <div className={card}><h2 className="mb-3 font-semibold">Agregar un servicio</h2>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Campo label="Nombre del servicio"><input className={inp} placeholder="Ej. Corte de cabello" value={f.nombre} onChange={set('nombre')} /></Campo>
          <Campo label="Descripción" hint="Puedes repetir el nombre si la descripción es distinta."><input className={inp} placeholder="Ej. Caballero, incluye lavado" value={f.descripcion} onChange={set('descripcion')} /></Campo>
          <Campo label="Duración de la cita"><select className={inp} value={f.duracion_min} onChange={set('duracion_min')}>{DUR.map(d => <option key={d} value={d}>{d} minutos</option>)}</select></Campo>
          <Campo label="Precio (MXN)"><input className={inp} type="number" min="0" step="0.01" placeholder="Ej. 150" value={f.costo} onChange={set('costo')} /></Campo>
        </div>
        <button onClick={add} className="mb-5 rounded-xl bg-violet-300 px-4 py-2.5 font-semibold text-violet-950">Agregar servicio</button>
        <Tabla cols={['Servicio', 'Descripción', 'Duración', 'Precio', '']} rows={sv.map(x => [x.nombre, x.descripcion || '—', `${x.duracion_min} min`, $(x.costo), <button className="text-rose-600" onClick={() => del(api.delServicio, x.id, 'Se borrarán también sus citas. ¿Continuar?')}>Eliminar</button>])} /></div>}

      {tab === 'horario' && <div className={card}><h2 className="mb-1 font-semibold">Días y horario de atención</h2>
        <p className="mb-3 text-sm text-slate-500">Marca los días que atiendes y define la hora de apertura y de cierre. Las citas ya agendadas no se modifican.</p>
        <div className="space-y-2">{ORDEN.map(d => { const h = hor.find(x => x.dia === d); return h && (
          <div key={d} className="flex flex-wrap items-center gap-3 border-t border-violet-100 pt-2">
            <label className="flex w-36 items-center gap-2"><input type="checkbox" checked={!!h.abierto} onChange={e => setDia(d, 'abierto', e.target.checked)} /><span className="font-medium">{DIAS[d]}</span></label>
            {h.abierto ? <><label className="text-sm">Abre <input type="time" className="rounded-xl border border-violet-200 bg-white p-1.5" value={h.inicio} onChange={e => setDia(d, 'inicio', e.target.value)} /></label>
              <label className="text-sm">Cierra <input type="time" className="rounded-xl border border-violet-200 bg-white p-1.5" value={h.fin} onChange={e => setDia(d, 'fin', e.target.value)} /></label></> : <span className="text-sm text-slate-500">Cerrado</span>}
          </div>); })}</div>
        <button onClick={guardar} className="mt-4 rounded-xl bg-violet-300 px-4 py-2.5 font-semibold text-violet-950">Guardar horario</button></div>}

      {tab === 'perfil' && <Perfil nid={nid} negocio={negocio} onCambio={cargarNeg} />}
    </>}
  </>);
}
const Tabla = ({ cols, rows }) => (
  <div className="overflow-x-auto"><table className="w-full text-left text-sm">
    <thead><tr>{cols.map((c, i) => <th key={i} className="p-2">{c}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-violet-100">{r.map((c, j) => <td key={j} className="p-2">{c}</td>)}</tr>)}</tbody>
  </table></div>);
