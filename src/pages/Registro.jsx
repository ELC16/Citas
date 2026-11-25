import { lazy, Suspense, useState } from 'react';
import { api } from '../api';
import { CATEGORIAS, ubicar } from '../geo';
const Mapa = lazy(() => import('./Mapa'));
const inp = 'mt-1 w-full rounded-xl border border-violet-200 bg-white p-2.5';
const Campo = ({ label, hint, children }) => (<label className="block"><span className="text-sm font-medium">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}</label>);
const vacio = { nombre: '', categoria: '', descripcion: '', direccion: '', telefono: '', email: '', password: '', password2: '', codigo: '' };

export default function Registro() {
  const [f, setF] = useState(vacio);
  const [punto, setPunto] = useState(null);
  const [msg, setMsg] = useState(null);
  const [listo, setListo] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const aqui = () => ubicar().then(setPunto).catch(e => setMsg(e.message));
  const enviar = async () => {
    if (!punto) return setMsg('Marca la ubicación de tu negocio en el mapa.');
    if (f.password !== f.password2) return setMsg('Las contraseñas no coinciden.');
    try { await api.registrar({ ...f, ...punto }); await api.login(f.email, f.password); setListo(true); setMsg(null); } catch (e) { setMsg(e.message); }
  };
  if (listo) return (<section className="rounded-3xl bg-white p-5 shadow-md shadow-violet-200/50"><h1 className="mb-2 text-xl font-semibold">¡Cuenta creada!</h1>
    <p className="mb-3 text-sm">Tu negocio ya aparece en el buscador. Entra a tu panel para agregar servicios, precios, horario, logo y foto.</p>
    <a className="inline-block rounded-xl bg-violet-300 px-4 py-2.5 font-semibold text-violet-950" href="#/admin">Ir a mi panel</a></section>);
  return (
    <section className="space-y-4 rounded-3xl bg-white p-5 shadow-md shadow-violet-200/50">
      <h1 className="text-2xl font-semibold">Crea la cuenta de tu negocio</h1>
      <Campo label="Correo electrónico" hint="Con este correo y tu contraseña entrarás a tu panel."><input className={inp} type="email" autoComplete="email" maxLength={120} value={f.email} onChange={set('email')} /></Campo>
      <Campo label="Contraseña" hint="Mínimo 10 caracteres."><input className={inp} type="password" autoComplete="new-password" value={f.password} onChange={set('password')} /></Campo>
      <Campo label="Repite la contraseña"><input className={inp} type="password" autoComplete="new-password" value={f.password2} onChange={set('password2')} /></Campo>
      <Campo label="Nombre del negocio"><input className={inp} maxLength={80} placeholder="Ej. Estética Luna" value={f.nombre} onChange={set('nombre')} /></Campo>
      <Campo label="Categoría" hint="Solo sirve para que te encuentren al filtrar; no se muestra a los clientes."><select className={inp} value={f.categoria} onChange={set('categoria')}><option value="">Elige una categoría</option>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select></Campo>
      <Campo label="Descripción (opcional)"><input className={inp} maxLength={300} placeholder="Ej. Cortes, tintes y peinados" value={f.descripcion} onChange={set('descripcion')} /></Campo>
      <Campo label="Dirección"><input className={inp} maxLength={150} placeholder="Calle, número y colonia" value={f.direccion} onChange={set('direccion')} /></Campo>
      <Campo label="Teléfono del negocio (opcional)"><input className={inp} type="tel" maxLength={30} value={f.telefono} onChange={set('telefono')} /></Campo>
      <div><span className="text-sm font-medium">Ubicación en el mapa</span>
        <p className="mb-2 text-xs text-slate-500">Toca el mapa para colocar el pin en tu negocio, o usa tu ubicación actual. Así te encuentran por distancia.</p>
        <button type="button" onClick={aqui} className="mb-2 w-full rounded-xl border border-violet-400 p-2.5 font-medium text-violet-700">📍 Usar mi ubicación actual</button>
        <Suspense fallback={<p>Cargando mapa…</p>}><Mapa onPick={setPunto} valor={punto} alto={300} /></Suspense>
        {punto && <p className="mt-1 text-xs text-emerald-700">Ubicación marcada ✓</p>}</div>
      <Campo label="Código de registro (solo si te lo dieron)"><input className={inp} value={f.codigo} onChange={set('codigo')} /></Campo>
      <button onClick={enviar} className="w-full rounded-xl bg-violet-300 p-3 font-semibold text-violet-950">Crear cuenta</button>
      {msg && <p className="text-rose-600">{msg}</p>}
    </section>
  );
}
