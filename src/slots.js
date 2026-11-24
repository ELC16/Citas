export const HORA_INICIO = 9, HORA_FIN = 18; // horario de atención
const p = n => String(n).padStart(2, '0');
export const slots = (dur, fecha) => {
  const out = [];
  for (let m = HORA_INICIO * 60; m + dur <= HORA_FIN * 60; m += dur) out.push(`${fecha} ${p((m / 60) | 0)}:${p(m % 60)}`);
  return out;
};
export const ahora = () => { const d = new Date(); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
