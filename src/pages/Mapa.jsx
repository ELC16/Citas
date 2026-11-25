import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
const VACIO = [];
const pin = c => L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: `<div style="width:22px;height:22px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 1px 4px #0006"></div>` });
const popup = n => { // se arma con textContent para que ningún nombre pueda inyectar HTML
  const d = document.createElement('div'), b = document.createElement('b'), a = document.createElement('a');
  b.textContent = n.nombre; a.href = `#/negocio/${n.id}`; a.textContent = 'Agendar cita →';
  d.append(b, document.createElement('br'), n.dist != null ? `a ${n.dist.toFixed(1)} km` : (n.direccion || ''), document.createElement('br'), a);
  return d;
};

export default function Mapa({ puntos = VACIO, pos, valor, onPick, alto = 380 }) {
  const el = useRef(), m = useRef(), capa = useRef(), sel = useRef();
  useEffect(() => {
    const map = L.map(el.current).setView([19.43, -99.13], 10);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
    capa.current = L.layerGroup().addTo(map); m.current = map;
    if (onPick) map.on('click', e => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }));
    return () => map.remove();
  }, []);
  useEffect(() => { // negocios y tu ubicación
    capa.current.clearLayers();
    const pts = puntos.map(n => { L.marker([n.lat, n.lng], { icon: pin('#8b5cf6') }).bindPopup(popup(n)).addTo(capa.current); return [n.lat, n.lng]; });
    if (pos) { L.marker([pos.lat, pos.lng], { icon: pin('#34d399') }).bindTooltip('Tú').addTo(capa.current); pts.push([pos.lat, pos.lng]); }
    if (pts.length) m.current.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
  }, [puntos, pos]);
  useEffect(() => { // punto elegido al registrar un negocio
    sel.current?.remove(); sel.current = null;
    if (valor) { sel.current = L.marker([valor.lat, valor.lng], { icon: pin('#fb7185') }).addTo(m.current); m.current.setView([valor.lat, valor.lng], Math.max(m.current.getZoom(), 16)); }
  }, [valor]);
  return <div ref={el} style={{ height: alto }} className="z-0 w-full overflow-hidden rounded-2xl" />;
}
