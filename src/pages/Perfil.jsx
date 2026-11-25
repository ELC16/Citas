import { useEffect, useState } from 'react';
import { api, DEMO } from '../api';
const inp = 'mt-1 w-full rounded-xl border border-violet-200 bg-white p-2.5';
const EJ = 'Hola {{1}}, tu cita de {{2}} en {{4}} quedó confirmada para el {{3}}. ¡Te esperamos!';
// recorta al centro y reduce la imagen en el navegador para que pese poco
const redim = (file, w, h, q) => new Promise((ok, no) => {
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const c = document.createElement('canvas'), x = c.getContext('2d'); c.width = w; c.height = h;
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    const s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
    x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', q));
  };
  img.onerror = () => no(new Error('No pudimos leer esa imagen.')); img.src = url;
});

export default function Perfil({ nid, negocio, onCambio }) {
  const [f, setF] = useState({ phone_id: '', token: '', plantilla: 'confirmacion_cita', idioma: 'es_MX' });
  const [wa, setWa] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api.whatsapp(nid).then(x => { setWa(x.configurado); if (x.configurado) setF(v => ({ ...v, phone_id: x.phone_id, plantilla: x.plantilla, idioma: x.idioma })); }).catch(() => {}); }, []);
  const run = async (fn, ok) => { try { await fn(); setMsg({ t: ok }); await onCambio(); } catch (e) { setMsg({ e: 1, t: e.message }); } };
  const subir = (tipo, w, h, q) => e => { const file = e.target.files[0]; e.target.value = ''; if (file) run(async () => api.subirImagen(nid, tipo, await redim(file, w, h, q)), 'Imagen guardada'); };
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const logo = negocio && api.imgUrl(negocio, 'logo'), foto = negocio && api.imgUrl(negocio, 'foto');
  const card = 'mb-4 rounded-3xl bg-white p-5 shadow-md shadow-violet-200/50';
  const quitar = 'ml-3 text-sm text-rose-600';
  return (<>
    <div className={card}><h2 className="mb-3 font-semibold">Logo y foto del banner</h2>
      <div className="mb-4"><p className="mb-1 text-sm font-medium">Logo (cuadrado, pequeño)</p>
        <div className="flex items-center gap-3">{logo ? <img src={logo} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-xl bg-violet-50 text-xs text-slate-500">Sin logo</div>}
          <input type="file" accept="image/*" onChange={subir('logo', 128, 128, 0.85)} className="text-sm" />
          {logo && <button className={quitar} onClick={() => run(() => api.quitarImagen(nid, 'logo'), 'Logo quitado')}>Quitar</button>}</div></div>
      <div><p className="mb-1 text-sm font-medium">Foto (aparece a la derecha del banner)</p>
        {foto ? <img src={foto} alt="" className="mb-2 aspect-video w-full max-w-xs rounded-xl object-cover" /> : <p className="mb-2 text-xs text-slate-500">Sin foto.</p>}
        <input type="file" accept="image/*" onChange={subir('foto', 640, 360, 0.8)} className="text-sm" />
        {foto && <button className={quitar} onClick={() => run(() => api.quitarImagen(nid, 'foto'), 'Foto quitada')}>Quitar</button>}</div>
      <p className="mt-3 text-xs text-slate-500">Las imágenes se recortan y reducen automáticamente.</p></div>

    <div className={card}><h2 className="mb-1 font-semibold">Confirmaciones por WhatsApp</h2>
      <p className="mb-3 text-sm text-slate-500">{DEMO ? 'En modo demo no se envían mensajes. ' : ''}Sin esta configuración, cada cita aparece en tu calendario con un botón <b>Confirmar por WhatsApp</b> que abre el chat con el cliente desde tu propio WhatsApp. Con ella, el mensaje sale solo desde el número de tu negocio.</p>
      <details className="mb-3 text-sm"><summary className="cursor-pointer font-medium text-violet-700">¿Cómo la configuro?</summary>
        <ol className="ml-5 mt-2 list-decimal space-y-1 text-slate-600">
          <li>Registra el número de tu negocio en WhatsApp Business Platform (Cloud API) de Meta.</li>
          <li>Crea una plantilla de categoría <b>Utilidad</b> con 4 variables: {'{{1}}'} nombre, {'{{2}}'} servicio, {'{{3}}'} fecha y hora, {'{{4}}'} negocio. Ejemplo: <i>{EJ}</i> Espera a que Meta la apruebe.</li>
          <li>Copia el <b>ID del número de teléfono</b> y un <b>token de acceso permanente</b> y pégalos abajo.</li>
          <li>Meta cobra cada mensaje de plantilla entregado, según su tarifa.</li></ol></details>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">ID del número de teléfono<input className={inp} inputMode="numeric" value={f.phone_id} onChange={set('phone_id')} /></label>
        <label className="text-sm">Token de acceso<input className={inp} type="password" autoComplete="off" placeholder={wa ? 'Guardado (déjalo vacío para conservarlo)' : ''} value={f.token} onChange={set('token')} /></label>
        <label className="text-sm">Nombre de la plantilla<input className={inp} value={f.plantilla} onChange={set('plantilla')} /></label>
        <label className="text-sm">Idioma de la plantilla<input className={inp} value={f.idioma} onChange={set('idioma')} /></label></div>
      <button onClick={() => run(async () => { await api.setWhatsapp(nid, f); setWa(true); setF({ ...f, token: '' }); }, 'WhatsApp configurado')} className="mt-3 rounded-xl bg-violet-300 px-4 py-2.5 font-semibold text-violet-950">Guardar</button>
      {wa && <button className={quitar} onClick={() => run(async () => { await api.delWhatsapp(nid); setWa(false); setF({ ...f, token: '' }); }, 'WhatsApp desactivado')}>Desactivar</button>}
      {msg && <p className={`mt-3 text-sm ${msg.e ? 'text-rose-600' : 'text-emerald-700'}`}>{msg.t}</p>}</div>
  </>);
}
