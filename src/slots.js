const p = n => String(n).padStart(2, '0');
export const DEFAULT_HORARIO = Array.from({ length: 7 }, (_, dia) => ({ dia, abierto: dia > 0 && dia < 6, inicio: '09:00', fin: '18:00' }));
export const hm = s => { const [h, m] = s.split(':'); return h * 60 + +m; };
export const diaDe = f => { const [y, m, d] = f.split('-').map(Number); return new Date(y, m - 1, d).getDay(); }; // 0 = domingo
export const slots = (dur, fecha, horario = DEFAULT_HORARIO, paso = dur) => {
  const h = horario.find(x => x.dia === diaDe(fecha)), out = [];
  if (!h || !h.abierto) return out;
  for (let m = hm(h.inicio); m + dur <= hm(h.fin); m += paso) out.push(`${fecha} ${p((m / 60) | 0)}:${p(m % 60)}`);
  return out;
};
export const ahora = () => { const d = new Date(); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
