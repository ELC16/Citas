export const CATEGORIAS = ['Belleza y peluquería', 'Barbería', 'Salud y consultorios', 'Dental', 'Spa y bienestar', 'Mascotas', 'Automotriz', 'Fitness y deporte', 'Educación', 'Otros'];
const rad = x => (x * Math.PI) / 180;
export const km = (a, b) => { // distancia en línea recta (Haversine)
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
export const parseCoords = t => { // acepta "19.65, -99.17" (como lo copia Google Maps)
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(t);
  const lat = m && +m[1], lng = m && +m[2];
  return m && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
};
export const ubicar = () => new Promise((ok, no) => {
  if (!navigator.geolocation) return no(new Error('Tu navegador no permite obtener la ubicación.'));
  navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => no(new Error('No pudimos obtener tu ubicación. Permite el acceso en tu navegador e intenta de nuevo.')), { timeout: 10000 });
});
