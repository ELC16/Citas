import { useState } from 'react';
import { api } from '../api';
const inp = 'min-w-28 flex-1 rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-800';
const card = 'mb-4 rounded-2xl bg-white p-5 shadow dark:bg-slate-800';
const $ = n => '$' + Number(n).toFixed(2);
const vacio = { nombre: '', descripcion: '', duracion_min: '', costo: '' };

export default function Admin() {
  const [ok, setOk] = useState(false);
  const [pw, setPw] = useState('');
  const [f, setF] = useState(vacio);
  const [sv, setSv] = useState([]);
  const [ct, setCt] = useState([]);
  const [err, setErr] = useState('');
  const run = async fn => { try { await fn(); setErr(''); } catch (e) { setErr(e.message); } };
  const refresh = async () => { setSv(await api.servicios()); setCt(await api.citas()); };
  const entrar = () => run(async () => { await api.login(pw); setPw(''); setOk(true); await refresh(); });
  const add = () => run(async () => { await api.addServicio(f); setF(vacio); await refresh(); });
  const del = (fn, id, q) => confirm(q) && run(async () => { await fn(id); await refresh(); });
  const set = k => e => setF({ ...f, [k]: e.target.value });

  return (<>
    {!ok && <div className={card}><h1 className="mb-3 text-xl font-semibold">Panel de administración</h1>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); entrar(); }}>
        <input className={inp} type="password" placeholder="Contraseña" value={pw} onChange={e => setPw(e.target.value)} />
        <button className="rounded-lg bg-blue-600 px-4 font-semibold text-white">Entrar</button></form></div>}
    {err && <p className="mb-3 text-red-600">{err}</p>}
    {ok && <>
      <div className={card}><h2 className="mb-3 font-semibold">Servicios y costos</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          <input className={inp} placeholder="Nombre" value={f.nombre} onChange={set('nombre')} />
          <input className={inp} placeholder="Descripción" value={f.descripcion} onChange={set('descripcion')} />
          <input className={inp} type="number" min="5" placeholder="Minutos" value={f.duracion_min} onChange={set('duracion_min')} />
          <input className={inp} type="number" min="0" step="0.01" placeholder="Costo" value={f.costo} onChange={set('costo')} />
          <button onClick={add} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Agregar</button></div>
        <Tabla cols={['Servicio', 'Min', 'Costo', '']} rows={sv.map(x => [x.nombre, x.duracion_min, $(x.costo), <button className="text-red-600" onClick={() => del(api.delServicio, x.id, 'Se borrarán también sus citas. ¿Continuar?')}>Eliminar</button>])} /></div>
      <div className={card}><h2 className="mb-3 font-semibold">Citas agendadas</h2>
        <Tabla cols={['Horario', 'Cliente', 'Servicio', 'Costo', '']} rows={ct.map(x => [x.horario, x.nombre, x.servicio, $(x.costo), <button className="text-red-600" onClick={() => del(api.delCita, x.id, '¿Cancelar esta cita?')}>Cancelar</button>])} /></div>
    </>}
  </>);
}
const Tabla = ({ cols, rows }) => (
  <div className="overflow-x-auto"><table className="w-full text-left text-sm">
    <thead><tr>{cols.map((c, i) => <th key={i} className="p-2">{c}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-slate-200 dark:border-slate-700">{r.map((c, j) => <td key={j} className="whitespace-nowrap p-2">{c}</td>)}</tr>)}</tbody>
  </table></div>);
