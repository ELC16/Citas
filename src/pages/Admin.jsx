import { useState } from 'react';
import { api } from '../api';
import Calendario from './Calendario';
const inp = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-800';
const card = 'mb-4 rounded-2xl bg-white p-5 shadow dark:bg-slate-800';
const $ = n => '$' + Number(n).toFixed(2);
const vacio = { nombre: '', descripcion: '', duracion_min: '30', costo: '' };
const DUR = [15, 20, 30, 45, 60, 90, 120, 180];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ORDEN = [1, 2, 3, 4, 5, 6, 0];
const Campo = ({ label, hint, children }) => (
  <label className="block"><span className="text-sm font-medium">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}</label>);

export default function Admin() {
  const [ok, setOk] = useState(false);
  const [tab, setTab] = useState('citas');
  const [pw, setPw] = useState('');
  const [f, setF] = useState(vacio);
  const [sv, setSv] = useState([]);
  const [ct, setCt] = useState([]);
  const [hor, setHor] = useState([]);
  const [msg, setMsg] = useState(null);
  const run = async (fn, okMsg) => { try { await fn(); setMsg(okMsg ? { t: okMsg } : null); } catch (e) { setMsg({ e: 1, t: e.message }); } };
  const refresh = async () => { setSv(await api.servicios()); setCt(await api.citas()); setHor(await api.horario()); };
  const entrar = () => run(async () => { await api.login(pw); setPw(''); setOk(true); await refresh(); });
  const add = () => run(async () => { await api.addServicio(f); setF(vacio); await refresh(); }, 'Servicio agregado');
  const del = (fn, id, q) => confirm(q) && run(async () => { await fn(id); await refresh(); });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const setDia = (dia, k, v) => setHor(hor.map(h => (h.dia === dia ? { ...h, [k]: v } : h)));
  const guardar = () => run(async () => { await api.setHorario(hor.map(h => ({ ...h, abierto: !!h.abierto }))); await refresh(); }, 'Horario guardado');

  return (<>
    {!ok && <div className={card}><h1 className="mb-3 text-xl font-semibold">Panel de administración</h1>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); entrar(); }}>
        <input className="w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-800" type="password" placeholder="Contraseña de administrador" value={pw} onChange={e => setPw(e.target.value)} />
        <button className="rounded-lg bg-blue-600 px-4 font-semibold text-white">Entrar</button></form></div>}
    {msg && <p className={`mb-3 ${msg.e ? 'text-red-600' : 'text-green-600'}`}>{msg.t}</p>}
    {ok && <>
      <div className="mb-3 flex flex-wrap gap-2">
        {[['citas', 'Calendario de citas'], ['servicios', 'Servicios y precios'], ['horario', 'Horario de atención']].map(([k, t]) =>
          <button key={k} onClick={() => { setTab(k); setMsg(null); }} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === k ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800'}`}>{t}</button>)}
      </div>

      {tab === 'citas' && <div className={card}><Calendario citas={ct} onDel={id => del(api.delCita, id, '¿Cancelar esta cita?')} /></div>}

      {tab === 'servicios' && <div className={card}><h2 className="mb-3 font-semibold">Agregar un servicio</h2>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Campo label="Nombre del servicio"><input className={inp} placeholder="Ej. Corte de cabello" value={f.nombre} onChange={set('nombre')} /></Campo>
          <Campo label="Descripción" hint="Puedes repetir el nombre si la descripción es distinta."><input className={inp} placeholder="Ej. Caballero, incluye lavado" value={f.descripcion} onChange={set('descripcion')} /></Campo>
          <Campo label="Duración de la cita"><select className={inp} value={f.duracion_min} onChange={set('duracion_min')}>{DUR.map(d => <option key={d} value={d}>{d} minutos</option>)}</select></Campo>
          <Campo label="Precio (MXN)"><input className={inp} type="number" min="0" step="0.01" placeholder="Ej. 150" value={f.costo} onChange={set('costo')} /></Campo>
        </div>
        <button onClick={add} className="mb-5 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white">Agregar servicio</button>
        <Tabla cols={['Servicio', 'Descripción', 'Duración', 'Precio', '']} rows={sv.map(x => [x.nombre, x.descripcion || '—', `${x.duracion_min} min`, $(x.costo), <button className="text-red-600" onClick={() => del(api.delServicio, x.id, 'Se borrarán también sus citas. ¿Continuar?')}>Eliminar</button>])} /></div>}

      {tab === 'horario' && <div className={card}><h2 className="mb-1 font-semibold">Días y horario de atención</h2>
        <p className="mb-3 text-sm text-slate-500">Marca los días que atiendes y define la hora de apertura y de cierre. Las citas ya agendadas no se modifican.</p>
        <div className="space-y-2">{ORDEN.map(d => { const h = hor.find(x => x.dia === d); return h && (
          <div key={d} className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-2 dark:border-slate-700">
            <label className="flex w-36 items-center gap-2"><input type="checkbox" checked={!!h.abierto} onChange={e => setDia(d, 'abierto', e.target.checked)} /><span className="font-medium">{DIAS[d]}</span></label>
            {h.abierto ? <><label className="text-sm">Abre <input type="time" className="rounded-lg border border-slate-300 bg-white p-1.5 dark:border-slate-600 dark:bg-slate-800" value={h.inicio} onChange={e => setDia(d, 'inicio', e.target.value)} /></label>
              <label className="text-sm">Cierra <input type="time" className="rounded-lg border border-slate-300 bg-white p-1.5 dark:border-slate-600 dark:bg-slate-800" value={h.fin} onChange={e => setDia(d, 'fin', e.target.value)} /></label></> : <span className="text-sm text-slate-500">Cerrado</span>}
          </div>); })}</div>
        <button onClick={guardar} className="mt-4 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white">Guardar horario</button></div>}
    </>}
  </>);
}
const Tabla = ({ cols, rows }) => (
  <div className="overflow-x-auto"><table className="w-full text-left text-sm">
    <thead><tr>{cols.map((c, i) => <th key={i} className="p-2">{c}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-slate-200 dark:border-slate-700">{r.map((c, j) => <td key={j} className="p-2">{c}</td>)}</tr>)}</tbody>
  </table></div>);

