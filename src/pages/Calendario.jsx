import { useState } from 'react';
const p = n => String(n).padStart(2, '0');
const NOM = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const $ = n => '$' + Number(n).toFixed(2);
const fin = c => { const [h, m] = c.horario.slice(11).split(':').map(Number), t = h * 60 + m + (c.duracion_min || 0); return `${p((t / 60) | 0)}:${p(t % 60)}`; };
const hoyStr = () => { const d = new Date(); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export default function Calendario({ citas, onDel }) {
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(hoyStr());
  const y = mes.getFullYear(), m = mes.getMonth();
  const vacias = (new Date(y, m, 1).getDay() + 6) % 7; // la semana empieza en lunes
  const dias = new Date(y, m + 1, 0).getDate();
  const porDia = {};
  citas.forEach(c => (porDia[c.horario.slice(0, 10)] ??= []).push(c));
  const fecha = d => `${y}-${p(m + 1)}-${p(d)}`;
  const delDia = (porDia[sel] || []).slice().sort((a, b) => a.horario.localeCompare(b.horario));
  const [sy, sm, sd] = sel.split('-').map(Number);
  const nav = 'rounded-lg border border-slate-300 px-3 py-1 dark:border-slate-600';

  return (<div>
    <div className="mb-3 flex items-center justify-between">
      <button className={nav} onClick={() => setMes(new Date(y, m - 1, 1))} aria-label="Mes anterior">‹</button>
      <h2 className="font-semibold capitalize">{mes.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</h2>
      <button className={nav} onClick={() => setMes(new Date(y, m + 1, 1))} aria-label="Mes siguiente">›</button>
    </div>
    <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">{NOM.map(n => <div key={n}>{n}</div>)}</div>
    <div className="mt-1 grid grid-cols-7 gap-1">
      {Array(vacias).fill(0).map((_, i) => <div key={'v' + i} />)}
      {Array.from({ length: dias }, (_, i) => i + 1).map(d => {
        const n = (porDia[fecha(d)] || []).length, activo = fecha(d) === sel, esHoy = fecha(d) === hoyStr();
        return (<button key={d} onClick={() => setSel(fecha(d))}
          className={`relative aspect-square rounded-lg border text-sm ${activo ? 'border-blue-600 bg-blue-600 text-white' : esHoy ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'}`}>
          {d}{n > 0 && <span className={`absolute bottom-0.5 right-1 text-[10px] font-bold ${activo ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`}>{n}</span>}
        </button>);
      })}
    </div>
    <h3 className="mb-2 mt-4 font-semibold capitalize">{new Date(sy, sm - 1, sd).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
    {delDia.length ? <ul className="divide-y divide-slate-200 dark:divide-slate-700">
      {delDia.map(c => <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
        <span><b>{c.horario.slice(11)}–{fin(c)}</b> · {c.nombre} · {c.servicio} · {$(c.costo)}</span>
        <button className="text-red-600" onClick={() => onDel(c.id)}>Cancelar</button></li>)}
    </ul> : <p className="text-sm text-slate-500">No hay citas este día.</p>}
  </div>);
}
