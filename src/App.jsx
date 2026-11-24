import { lazy, Suspense, useEffect, useState } from 'react';
import Cliente from './pages/Cliente';
import { DEMO } from './api';
const Admin = lazy(() => import('./pages/Admin')); // el panel se descarga solo si lo abres

export default function App() {
  const [admin, setAdmin] = useState(location.hash === '#/admin');
  useEffect(() => {
    const f = () => setAdmin(location.hash === '#/admin');
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const link = 'text-sm underline text-blue-600 dark:text-blue-400';
  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <main className={`mx-auto ${admin ? 'max-w-3xl' : 'max-w-xl'}`}>
        <nav className="mb-3 flex gap-4"><a className={link} href="#/">Reservar</a><a className={link} href="#/admin">Administrador</a></nav>
        {DEMO && <p className="mb-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-900">Modo demo: los datos se guardan solo en este navegador. Contraseña de admin: <b>demo1234</b>.</p>}
        {admin ? <Suspense fallback={<p>Cargando…</p>}><Admin /></Suspense> : <Cliente />}
      </main>
    </div>
  );
}
