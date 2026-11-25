import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { CATEGORIAS, km, ubicar } from '../geo';
const inp = 'w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-800';
const RADIOS = [1, 3, 5, 10, 25, 50];
const sinAcentos = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function Directorio() {
  const [lista, setLista] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [pos, setPos] = useState(null);
  const [radio, setRadio] = useState('10');
  const [msg, setMsg] = useState('');
  useEffect(() => { api.negocios().then(setLista).catch(e => setMsg(e.message)); }, []);

  const cerca = () => ubicar().then(p => { setPos(p); setMsg(''); }).catch(e => setMsg(e.message));
  const vista = useMemo(() => {
    const t = sinAcentos(q.trim());
    return (lista || [])
      .map(n => ({ ...n, dist: pos ? km(pos, n) : null }))
      .filter(n => (!cat || n.categoria === cat) && (!t || sinAcentos(`${n.nombre} ${n.descripcion} ${n.categoria} ${n.direccion}`).includes(t)) && (!pos || n.dist <= +radio))
      .sort((a, b) => (pos ? a.dist - b.dist : a.nombre.localeCompare(b.nombre)));
  }, [lista, q, cat, pos, radio]);

  return (
    <section className="space-y-4">
      <div className="space-y-3 rounded-2xl bg-white p-5 shadow dark:bg-slate-800">
        <h1 className="text-2xl font-semibold">Encuentra un negocio y agenda tu cita</h1>
        <input className={inp} placeholder="Buscar por nombre, servicio o dirección" value={q} onChange={e => setQ(e.target.value)} />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm text-slate-500">Categoría
            <select className={inp} value={cat} onChange={e => setCat(e.target.value)}><option value="">Todas las categorías</option>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="text-sm text-slate-500">Distancia máxima
            <select className={inp} disabled={!pos} value={radio} onChange={e => setRadio(e.target.value)}>{RADIOS.map(r => <option key={r} value={r}>{r} km</option>)}</select></label>
        </div>
        {pos ? <button className="text-sm text-blue-600 underline dark:text-blue-400" onClick={() => setPos(null)}>Quitar filtro de distancia</button>
          : <button onClick={cerca} className="w-full rounded-lg border border-blue-600 p-2.5 font-medium text-blue-600 dark:text-blue-400">📍 Buscar cerca de mí</button>}
        {msg && <p className="text-sm text-red-600">{msg}</p>}
      </div>
      {lista === null ? <p>Cargando negocios…</p> : !vista.length ? <p className="text-slate-500">No encontramos negocios con esos filtros. Prueba con otra categoría o una distancia mayor.</p> :
        vista.map(n => (
          <a key={n.id} href={`#/negocio/${n.id}`} className="block rounded-2xl bg-white p-5 shadow hover:ring-2 hover:ring-blue-500 dark:bg-slate-800">
            <div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{n.nombre}</h2>
              {n.dist !== null && <span className="whitespace-nowrap text-sm text-slate-500">a {n.dist < 1 ? `${Math.round(n.dist * 1000)} m` : `${n.dist.toFixed(1)} km`}</span>}</div>
            <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">{n.categoria}</span>
            {n.descripcion && <p className="mt-2 text-sm">{n.descripcion}</p>}
            {n.direccion && <p className="mt-1 text-sm text-slate-500">{n.direccion}</p>}
            <p className="mt-3 text-sm font-semibold text-blue-600 dark:text-blue-400">Agendar cita →</p>
          </a>))}
    </section>
  );
}
