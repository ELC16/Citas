import { useEffect, useState } from 'react';
import { api } from '../api';
const mxn = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const inp = 'w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-800';

export default function Cliente() {
  const [servicios, setServicios] = useState([]);
  const [sid, setSid] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [horas, setHoras] = useState([]);
  const [hora, setHora] = useState('');
  const [nombre, setNombre] = useState('');
  const [msg, setMsg] = useState(null);
  const err = e => setMsg({ e: 1, t: e.message });

  useEffect(() => { api.servicios().then(s => { setServicios(s); if (s[0]) setSid(String(s[0].id)); }).catch(err); }, []);
  const cargar = () => { setHora(''); if (sid) api.disponibilidad(sid, fecha).then(setHoras).catch(err); };
  useEffect(cargar, [sid, fecha]);

  const s = servicios.find(x => x.id == sid);
  const enviar = async () => {
    try {
      const r = await api.crearCita({ nombre, servicio_id: +sid, horario: `${fecha} ${hora}` });
      setMsg({ t: `Cita confirmada: ${r.servicio}, ${r.horario}. Costo ${mxn(r.costo)}.` }); setNombre('');
    } catch (e) { err(e); }
    cargar();
  };

  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow dark:bg-slate-800">
      <h1 className="text-2xl font-semibold">Agenda tu cita</h1>
      {!servicios.length ? <p className="text-slate-500">Aún no hay servicios disponibles.</p> : <>
        <label className="block text-sm text-slate-500">Servicio
          <select className={inp} value={sid} onChange={e => setSid(e.target.value)}>{servicios.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select>
        </label>
        {s && <p className="text-sm text-slate-500">{mxn(s.costo)} · {s.duracion_min} min{s.descripcion && ` · ${s.descripcion}`}</p>}
        <label className="block text-sm text-slate-500">Fecha
          <input className={inp} type="date" min={hoy()} value={fecha} onChange={e => setFecha(e.target.value)} />
        </label>
        <div><p className="mb-1 text-sm text-slate-500">Horarios disponibles</p>
          <div className="flex flex-wrap gap-2">
            {horas.length ? horas.map(h => <button key={h} onClick={() => setHora(h)} className={`rounded-lg border px-3 py-2 ${h === hora ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{h}</button>) : <span className="text-slate-500">Sin horarios libres ese día</span>}
          </div></div>
        <label className="block text-sm text-slate-500">Tu nombre
          <input className={inp} maxLength={80} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo" />
        </label>
        <button disabled={!hora || nombre.trim().length < 2} onClick={enviar} className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white disabled:opacity-50">Confirmar cita</button>
      </>}
      {msg && <p className={msg.e ? 'text-red-600' : 'text-green-600'}>{msg.t}</p>}
    </section>
  );
}
