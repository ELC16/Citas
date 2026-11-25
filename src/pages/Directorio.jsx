import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { CATEGORIAS, km, ubicar } from '../geo';
const Mapa = lazy(() => import('./Mapa')); // el mapa se descarga solo cuando lo abres
const inp = 'w-full rounded-xl border border-violet-200 bg-white p-2.5';
const RADIOS = [1, 3, 5, 10, 25, 50];
const sinAcentos = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function Directorio() {
  const [lista, setLista] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [pos, setPos] = useState(null);
  const [radio, setRadio] = useState('10');
  const [modo, setModo] = useState('lista');
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
      <div className="space-y-3 rounded-3xl bg-white p-5 shadow-md shadow-violet-200/50">
        <h1 className="text-2xl font-semibold text-slate-800">¿Qué cita necesitas hoy? ✨</h1>
        <p className="-mt-2 text-sm text-slate-500">Busca cerca de ti y agenda en un minuto.</p>
        <input className={inp} placeholder="Buscar por nombre, servicio o dirección" value={q} onChange={e => setQ(e.target.value)} />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm text-slate-500">Categoría
            <select className={inp} value={cat} onChange={e => setCat(e.target.value)}><option value="">Todas las categorías</option>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="text-sm text-slate-500">Distancia máxima
            <select className={inp} disabled={!pos} value={radio} onChange={e => setRadio(e.target.value)}>{RADIOS.map(r => <option key={r} value={r}>{r} km</option>)}</select></label>
        </div>
        {pos ? <button className="text-sm text-violet-700 underline" onClick={() => setPos(null)}>Quitar filtro de distancia</button>
          : <button onClick={cerca} className="w-full rounded-xl border border-violet-400 p-2.5 font-medium text-violet-700">📍 Buscar cerca de mí</button>}
        {msg && <p className="text-sm text-rose-600">{msg}</p>}
      </div>
      <div className="flex gap-2">{[['lista', 'Lista'], ['mapa', 'Mapa']].map(([k, t]) =>
        <button key={k} onClick={() => setModo(k)} className={`rounded-xl px-4 py-2 text-sm font-medium ${modo === k ? 'bg-violet-300 text-violet-950' : 'bg-white'}`}>{t}</button>)}</div>
      {lista === null ? <p>Cargando negocios…</p> : !vista.length ? <p className="text-slate-500">No encontramos negocios con esos filtros. Prueba con otra categoría o una distancia mayor.</p> :
        modo === 'mapa' ? <Suspense fallback={<p>Cargando mapa…</p>}><Mapa puntos={vista} pos={pos} /></Suspense> :
        vista.map(n => { const logo = api.imgUrl(n, 'logo'); return (
          <a key={n.id} href={`#/negocio/${n.id}`} className="flex gap-3 rounded-3xl bg-white p-5 shadow-md shadow-violet-200/50 hover:ring-2 hover:ring-violet-300">
            {logo && <img src={logo} alt="" loading="lazy" className="h-12 w-12 flex-none rounded-xl object-cover" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{n.nombre}</h2>
                {n.dist !== null && <span className="whitespace-nowrap text-sm text-slate-500">a {n.dist < 1 ? `${Math.round(n.dist * 1000)} m` : `${n.dist.toFixed(1)} km`}</span>}</div>
              {n.descripcion && <p className="mt-2 text-sm">{n.descripcion}</p>}
              {n.direccion && <p className="mt-1 text-sm text-slate-500">{n.direccion}</p>}
              <p className="mt-3 text-sm font-semibold text-violet-700">Agendar cita →</p></div>
          </a>); })}
    </section>
  );
}
