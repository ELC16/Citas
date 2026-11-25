import { useEffect, useState } from 'react';
import { api } from '../api';
import { diaDe } from '../slots';
const mxn = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const inp = 'w-full rounded-xl border border-violet-200 bg-white p-2.5';
const etiqueta = s => (s.descripcion ? `${s.nombre} — ${s.descripcion}` : s.nombre);
const COL = { 1: 'bg-pink-200', 2: 'bg-amber-200', 3: 'bg-emerald-200', 4: 'bg-sky-200' };
const Paso = ({ n, t, children }) => (
  <div><h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-800"><span className={`grid h-7 w-7 place-items-center rounded-full text-sm text-slate-700 ${COL[n]}`}>{n}</span>{t}</h2>{children}</div>);

export default function Cliente({ nid }) {
  const [negocio, setNegocio] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [horario, setHorario] = useState([]);
  const [sid, setSid] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [horas, setHoras] = useState([]);
  const [hora, setHora] = useState('');
  const [celular, setCelular] = useState('');
  const [nombre, setNombre] = useState('');
  const [msg, setMsg] = useState(null);
  const err = e => setMsg({ e: 1, t: e.message });

  useEffect(() => {
    api.negocios().then(l => setNegocio(l.find(x => x.id == nid) || false)).catch(err);
    api.horario(nid).then(setHorario).catch(err);
    api.servicios(nid).then(s => { setServicios(s); if (s[0]) setSid(String(s[0].id)); }).catch(err);
  }, []);
  const cargar = () => { setHora(''); if (sid && fecha) api.disponibilidad(nid, sid, fecha).then(setHoras).catch(err); };
  useEffect(cargar, [sid, fecha]);

  const s = servicios.find(x => x.id == sid);
  const hd = fecha && horario.find(h => h.dia === diaDe(fecha));
  const cerrado = hd && !hd.abierto;
  const logo = negocio && api.imgUrl(negocio, 'logo'), foto = negocio && api.imgUrl(negocio, 'foto');
  const enviar = async () => {
    try {
      const r = await api.crearCita(nid, { nombre, celular, servicio_id: +sid, horario: `${fecha} ${hora}` });
      setMsg({ t: `¡Listo! Cita registrada: ${r.servicio}, ${r.horario}. Total a pagar: ${mxn(r.costo)}. ${r.whatsapp ? 'Te enviamos la confirmación por WhatsApp.' : 'El negocio te confirmará por WhatsApp.'}` }); setNombre('');
    } catch (e) { err(e); }
    cargar();
  };

  return (
    <section className="space-y-5 rounded-3xl bg-white p-5 shadow-md shadow-violet-200/50">
      <a href="#/" className="text-sm text-violet-700 underline">← Volver a la búsqueda</a>
      {negocio === false ? <p className="text-rose-600">No encontramos este negocio.</p> : negocio && (
        <div className="flex overflow-hidden rounded-2xl bg-pink-50">
          <div className="flex min-w-0 flex-1 items-center gap-3 p-3">
            {logo && <img src={logo} alt="" className="h-14 w-14 flex-none rounded-xl object-cover" />}
            <div className="min-w-0"><h1 className="text-xl font-semibold">{negocio.nombre}</h1>
              <p className="text-sm text-slate-500">{negocio.direccion}{negocio.direccion && negocio.telefono && ' · '}{negocio.telefono && <a className="underline" href={`tel:${negocio.telefono}`}>{negocio.telefono}</a>}</p></div>
          </div>
          {foto && <img src={foto} alt="" className="w-2/5 flex-none object-cover" />}
        </div>)}
      {!servicios.length ? <p className="text-slate-500">Este negocio aún no tiene servicios disponibles.</p> : <>
        <Paso n="1" t="Elige el servicio">
          <select className={inp} value={sid} onChange={e => setSid(e.target.value)}>{servicios.map(x => <option key={x.id} value={x.id}>{etiqueta(x)}</option>)}</select>
          {s && <p className="mt-1 text-sm text-slate-500">Precio: <b>{mxn(s.costo)}</b> · Duración: {s.duracion_min} min</p>}
        </Paso>
        <Paso n="2" t="Elige el día">
          <input className={inp} type="date" min={hoy()} value={fecha} onChange={e => setFecha(e.target.value)} />
          {hd && <p className={`mt-1 text-sm ${cerrado ? 'text-rose-600' : 'text-slate-500'}`}>{cerrado ? 'Ese día no hay atención. Elige otro día.' : `Atendemos de ${hd.inicio} a ${hd.fin}`}</p>}
        </Paso>
        {!cerrado && <Paso n="3" t="Elige la hora">
          <div className="flex flex-wrap gap-2">
            {horas.length ? horas.map(h => <button key={h} onClick={() => setHora(h)} className={`rounded-xl border px-3 py-2 ${h === hora ? 'border-violet-400 bg-violet-300 text-violet-950' : 'border-violet-200'}`}>{h}</button>) : <span className="text-slate-500">No quedan horas libres ese día.</span>}
          </div>
        </Paso>}
        <Paso n="4" t="Tu celular para la confirmación">
          <input className={inp} type="tel" inputMode="numeric" autoComplete="tel" maxLength={20} value={celular} onChange={e => setCelular(e.target.value)} placeholder="10 dígitos, ej. 5512345678" />
          <input className={`${inp} mt-2`} maxLength={80} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre (opcional)" />
        </Paso>
        <button disabled={!hora || celular.replace(/\D/g, '').length < 10} onClick={enviar} className="w-full rounded-xl bg-violet-300 p-3 font-semibold text-violet-950 disabled:opacity-50">Confirmar cita</button>
      </>}
      {msg && <p className={msg.e ? 'text-rose-600' : 'text-emerald-700'}>{msg.t}</p>}
    </section>
  );
}
