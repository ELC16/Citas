import { useEffect, useState } from 'react';
import { api } from '../api';
import { diaDe } from '../slots';
const mxn = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const inp = 'w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-800';
const etiqueta = s => (s.descripcion ? `${s.nombre} — ${s.descripcion}` : s.nombre);
const Paso = ({ n, t, children }) => (
  <div><h2 className="mb-2 flex items-center gap-2 font-semibold"><span className="grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-xs text-white">{n}</span>{t}</h2>{children}</div>);

export default function Cliente() {
  const [servicios, setServicios] = useState([]);
  const [horario, setHorario] = useState([]);
  const [sid, setSid] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [horas, setHoras] = useState([]);
  const [hora, setHora] = useState('');
  const [nombre, setNombre] = useState('');
  const [msg, setMsg] = useState(null);
  const err = e => setMsg({ e: 1, t: e.message });

  useEffect(() => {
    api.horario().then(setHorario).catch(err);
    api.servicios().then(s => { setServicios(s); if (s[0]) setSid(String(s[0].id)); }).catch(err);
  }, []);
  const cargar = () => { setHora(''); if (sid && fecha) api.disponibilidad(sid, fecha).then(setHoras).catch(err); };
  useEffect(cargar, [sid, fecha]);

  const s = servicios.find(x => x.id == sid);
  const hd = fecha && horario.find(h => h.dia === diaDe(fecha));
  const cerrado = hd && !hd.abierto;
  const enviar = async () => {
    try {
      const r = await api.crearCita({ nombre, servicio_id: +sid, horario: `${fecha} ${hora}` });
      setMsg({ t: `¡Listo! Cita confirmada: ${r.servicio}, ${r.horario}. Total a pagar: ${mxn(r.costo)}.` }); setNombre('');
    } catch (e) { err(e); }
    cargar();
  };

  return (
    <section className="space-y-5 rounded-2xl bg-white p-5 shadow dark:bg-slate-800">
      <h1 className="text-2xl font-semibold">Agenda tu cita</h1>
      {!servicios.length ? <p className="text-slate-500">Aún no hay servicios disponibles.</p> : <>
        <Paso n="1" t="Elige el servicio">
          <select className={inp} value={sid} onChange={e => setSid(e.target.value)}>{servicios.map(x => <option key={x.id} value={x.id}>{etiqueta(x)}</option>)}</select>
          {s && <p className="mt-1 text-sm text-slate-500">Precio: <b>{mxn(s.costo)}</b> · Duración: {s.duracion_min} min</p>}
        </Paso>
        <Paso n="2" t="Elige el día">
          <input className={inp} type="date" min={hoy()} value={fecha} onChange={e => setFecha(e.target.value)} />
          {hd && <p className={`mt-1 text-sm ${cerrado ? 'text-red-600' : 'text-slate-500'}`}>{cerrado ? 'Ese día no hay atención. Elige otro día.' : `Atendemos de ${hd.inicio} a ${hd.fin}`}</p>}
        </Paso>
        {!cerrado && <Paso n="3" t="Elige la hora">
          <div className="flex flex-wrap gap-2">
            {horas.length ? horas.map(h => <button key={h} onClick={() => setHora(h)} className={`rounded-lg border px-3 py-2 ${h === hora ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{h}</button>) : <span className="text-slate-500">No quedan horas libres ese día.</span>}
          </div>
        </Paso>}
        <Paso n="4" t="Escribe tu nombre">
          <input className={inp} maxLength={80} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. María López" />
        </Paso>
        <button disabled={!hora || nombre.trim().length < 2} onClick={enviar} className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white disabled:opacity-50">Confirmar cita</button>
      </>}
      {msg && <p className={msg.e ? 'text-red-600' : 'text-green-600'}>{msg.t}</p>}
    </section>
  );
}

