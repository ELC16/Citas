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
  const link = 'text-sm underline text-blue-600 dark:text-blue-400';
  const [pag, id] = r;
  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <main className={`mx-auto ${pag === 'admin' ? 'max-w-3xl' : 'max-w-xl'}`}>
        <nav className="mb-3 flex gap-4"><a className={link} href="#/">Buscar negocios</a><a className={link} href="#/admin">Soy un negocio</a></nav>
        {DEMO && <p className="mb-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-900">Modo demo: negocios de ejemplo y datos guardados solo en este navegador. Contraseña de admin de los negocios de ejemplo: <b>demo1234</b>.</p>}
        <Suspense fallback={<p>Cargando…</p>}>
          {pag === 'negocio' && id ? <Cliente key={id} nid={id} /> : pag === 'admin' ? <Admin key={id || 'x'} nid={id} /> : pag === 'registro' ? <Registro /> : <Directorio />}
        </Suspense>
      </main>
    </div>
  );
}
