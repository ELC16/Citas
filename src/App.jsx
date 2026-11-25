import { lazy, Suspense, useEffect, useState } from 'react';
import Directorio from './pages/Directorio';
import { DEMO } from './api';
const Cliente = lazy(() => import('./pages/Cliente'));
const Admin = lazy(() => import('./pages/Admin'));
const Registro = lazy(() => import('./pages/Registro'));
const ruta = () => location.hash.replace(/^#\/?/, '').split('/'); // '#/negocio/3' -> ['negocio','3']

export default function App() {
  const [r, setR] = useState(ruta());
  useEffect(() => {
    const f = () => { setR(ruta()); scrollTo(0, 0); };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const link = 'rounded-full bg-white/80 px-4 py-1.5 text-sm font-medium text-violet-800 shadow-sm hover:bg-white';
  const [pag, id] = r;
  return (
    <div className="min-h-screen bg-linear-to-b from-pink-50 via-amber-50 to-sky-50 p-4 text-slate-700">
      <main className={`mx-auto ${pag === 'admin' ? 'max-w-3xl' : 'max-w-xl'}`}>
        <nav className="mb-4 flex flex-wrap items-center gap-2"><span className="mr-auto text-lg font-bold text-violet-800">💜 Citas cerca de ti</span><a className={link} href="#/">Buscar negocios</a><a className={link} href="#/admin">Soy un negocio</a></nav>
        {DEMO && <p className="mb-3 rounded-xl bg-amber-100 p-3 text-sm text-amber-900">Modo demo: negocios de ejemplo y datos guardados solo en este navegador. Cuentas de negocio de ejemplo: <b>luna@demo.com</b>, patron@demo.com, sonrisa@demo.com o patitas@demo.com · contraseña <b>demo1234</b>.</p>}
        <Suspense fallback={<p>Cargando…</p>}>
          {pag === 'negocio' && id ? <Cliente key={id} nid={id} /> : pag === 'admin' ? <Admin /> : pag === 'registro' ? <Registro /> : <Directorio />}
        </Suspense>
      </main>
    </div>
  );
}
