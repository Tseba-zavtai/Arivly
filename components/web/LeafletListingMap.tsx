import React, { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import type { ListingCoordinate, LocatedListing } from '@/lib/webLocationListings';

export default function LeafletListingMap({ items, origin, radiusKm, selectedId, onSelect, onError }: {
  items: LocatedListing[]; origin: ListingCoordinate | null; radiusKm: number | null;
  selectedId: string | null; onSelect: (id: string) => void; onError: (message: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const api = useRef<typeof Leaflet | null>(null);
  const callbacks = useRef({ onSelect, onError }); callbacks.current = { onSelect, onError };
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false; let resize: ResizeObserver | undefined;
    import('leaflet').then(module => {
      if (disposed || !element.current) return;
      const L = module.default ?? module; api.current = L;
      const instance = L.map(element.current, { scrollWheelZoom: false }).setView([47.9184,106.9177],12);
      map.current = instance;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, updateWhenIdle:true,
        attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).on('tileerror',()=>callbacks.current.onError('Газрын зургийн зарим хэсэг ачаалсангүй. Жагсаалтаар заруудаа үзэх боломжтой.')).addTo(instance);
      layer.current = L.layerGroup().addTo(instance);
      resize = new ResizeObserver(()=>instance.invalidateSize()); resize.observe(element.current);
      setReady(true);
    }).catch(()=>callbacks.current.onError('Газрын зураг ачаалсангүй. Жагсаалт сонгоод заруудаа үзээрэй.'));
    return () => { disposed=true; resize?.disconnect(); map.current?.remove(); map.current=null; layer.current=null; };
  }, []);
  useEffect(() => {
    const L=api.current, instance=map.current, group=layer.current;
    if (!ready || !L || !instance || !group) return;
    group.clearLayers();
    items.forEach(({job,coordinate})=>{
      const selected=job.id===selectedId;
      const label=document.createElement('span'); label.textContent=job.title || job.subcategory || 'Түрээсийн зар';
      L.circleMarker([coordinate.latitude,coordinate.longitude],{radius:selected?12:8,color:'#fff',weight:2,fillColor:selected?'#ed7a4b':'#6e0ab0',fillOpacity:1})
        .bindTooltip(label).on('click',()=>callbacks.current.onSelect(job.id)).addTo(group);
    });
    if (origin) {
      if (radiusKm != null) L.circle([origin.latitude,origin.longitude],{radius:radiusKm*1000,color:'#6e0ab0',weight:1,fillOpacity:.05}).addTo(group);
      L.circleMarker([origin.latitude,origin.longitude],{radius:7,color:'#fff',weight:3,fillColor:'#2774e8',fillOpacity:1}).bindTooltip('Таны байршил').addTo(group);
    }
  }, [ready,items,origin,radiusKm,selectedId]);
  const boundsKey=items.map(item=>`${item.job.id}:${item.coordinate.latitude}:${item.coordinate.longitude}`).join('|');
  useEffect(()=>{
    const L=api.current, instance=map.current; if (!ready || !L || !instance) return;
    if (origin && radiusKm != null) {
      instance.fitBounds(L.circle([origin.latitude,origin.longitude],{radius:Math.max(radiusKm, .5)*1000}).getBounds(),{padding:[25,25],maxZoom:15});
    } else if(items.length) instance.fitBounds(items.map(item=>[item.coordinate.latitude,item.coordinate.longitude] as [number,number]),{padding:[35,35],maxZoom:14});
    // A marker selection changes highlighting without resetting a user's map pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ready,boundsKey,origin,radiusKm]);
  return <div className="tw-location-map" ref={element} role="region" aria-label="Байршилтай түрээсийн заруудын газрын зураг" />;
}
