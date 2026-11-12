import React, { useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { useJobs } from '@/contexts/JobsContext';
import { locatedListings, type ListingCoordinate, type LocatedListing } from '@/lib/webLocationListings';
import LeafletListingMap from './LeafletListingMap';

function Result({item,selected,onSelect}:{item:LocatedListing;selected:boolean;onSelect:()=>void}) {
  const {job,distanceKm}=item;
  const image=job.image_urls?.[0] || job.image_url;
  return <article className={`tw-location-result ${selected?'is-selected':''}`}>
    {image && <img src={image} alt="" loading="lazy" />}
    <div><button className="tw-location-title" onClick={onSelect}>{job.title || job.subcategory || 'Түрээсийн зар'}</button>
      <p>{job.location?.address || job.category || 'Байршилтай зар'}</p>
      {distanceKm!==null && <small>Ойролцоогоор {distanceKm<1?`${Math.round(distanceKm*1000)} м`:`${distanceKm.toFixed(1)} км`}</small>}
      <Link href={{pathname:'/job-detail',params:{id:job.id}}}>Дэлгэрэнгүй ↗</Link>
    </div>
  </article>;
}
export default function WebLocationExplorer({preview=false}:{preview?:boolean}) {
  const {jobs,isLoading}=useJobs();
  const [view,setView]=useState<'map'|'list'>('map');
  const [origin,setOrigin]=useState<ListingCoordinate|null>(null);
  const [near,setNear]=useState(false),[locating,setLocating]=useState(false);
  const [radius,setRadius]=useState(1);
  const [query,setQuery]=useState(''),[category,setCategory]=useState('');
  const [selected,setSelected]=useState<string|null>(null),[message,setMessage]=useState('');
  const [mapError,setMapError]=useState('');
  const allLocated=useMemo(()=>locatedListings(jobs),[jobs]);
  const categories=useMemo(()=>Array.from(new Set(allLocated.map(item=>item.job.category).filter((name):name is string=>!!name))).sort(),[allLocated]);
  const items=useMemo(()=>locatedListings(jobs,{query,category,origin:near?origin:null,radiusKm:near?radius:null}),[jobs,query,category,near,origin,radius]);
  function nearby() {
    if(preview){setMessage('Надад ойр сонголтыг нийтэлсэн нүүр дээр өөрийн төхөөрөмжөөс шалгана.');return;}
    if(origin){setNear(true);setMessage('');return;}
    if(!navigator.geolocation){setMessage('Энэ браузер байршил тогтоох боломжгүй. Бүх байршилтай зарыг үзэж болно.');return;}
    setLocating(true);setMessage('');
    navigator.geolocation.getCurrentPosition(position=>{
      setOrigin({latitude:position.coords.latitude,longitude:position.coords.longitude});setNear(true);setLocating(false);
    },error=>{setLocating(false);setNear(false);setMessage(error.code===1?'Байршлын зөвшөөрөл өгөөгүй байна. Бүх байршилтай зар харагдаж байна.':'Байршлыг тогтоож чадсангүй. Дахин оролдох эсвэл бүх зарыг үзээрэй.');},{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
  }
  return <div className="tw-location-explorer">
    <div className="tw-location-controls"><div className="tw-filter-tabs" role="group" aria-label="Байршлын харагдац"><button onClick={()=>setView('map')} aria-pressed={view==='map'} className={view==='map'?'is-active':''}>Газрын зураг</button><button onClick={()=>setView('list')} aria-pressed={view==='list'} className={view==='list'?'is-active':''}>Жагсаалт</button></div><div className="tw-filter-tabs" role="group" aria-label="Байршлын шүүлтүүр"><button className={!near?'is-active':''} onClick={()=>{setNear(false);setMessage('');}}>Бүх байршил</button><button className={near?'is-active':''} disabled={locating} onClick={nearby}>{locating?'Байршил тогтоож байна…':'⌖ Надад ойр'}</button></div>
    {near && <label>Зай<select aria-label="Ойр зарын зай" value={radius} onChange={event=>setRadius(Number(event.target.value))}>{[1,5,10,50].map(value=><option key={value} value={value}>{value} км</option>)}</select></label>}</div>
    <div className="tw-location-search"><input aria-label="Байршилтай зар хайх" placeholder="Зарын нэр, байршлаар хайх…" value={query} onChange={event=>setQuery(event.target.value)} /><select aria-label="Газрын зургийн ангилал" value={category} onChange={event=>setCategory(event.target.value)}><option value="">Бүх ангилал</option>{categories.map(name=><option key={name} value={name}>{name}</option>)}</select></div>
    <p className="tw-result-count" aria-live="polite">{isLoading?'Заруудыг ачаалж байна…':`${items.length} байршилтай зар${near?' · ойроос хол руу':''}`}</p>
    {message && <p className="tw-location-notice" role="status">{message}</p>}
    {mapError && view==='map' && <p className="tw-location-notice" role="status">{mapError} <button onClick={()=>setView('list')}>Жагсаалтаар үзэх</button></p>}
    {view==='map'?<div className="tw-location-split"><LeafletListingMap items={items} origin={near?origin:null} radiusKm={near?radius:null} selectedId={selected} onSelect={id=>{setSelected(id);document.getElementById(`map-result-${id}`)?.scrollIntoView({behavior:'smooth',block:'nearest'});}} onError={setMapError}/><div className="tw-location-results" aria-label="Газрын зураг дахь зарууд">{items.map(item=><div id={`map-result-${item.job.id}`} key={item.job.id}><Result item={item} selected={selected===item.job.id} onSelect={()=>setSelected(item.job.id)} /></div>)}{!items.length && !isLoading && <p className="tw-location-empty">Энэ шүүлтүүрт тохирох байршилтай зар алга. Ангилал, хайлт эсвэл зайгаа өөрчлөөрэй.</p>}</div></div>:<div className="tw-location-list">{items.map(item=><Result key={item.job.id} item={item} selected={selected===item.job.id} onSelect={()=>{setSelected(item.job.id);setView('map');}} />)}{!items.length && !isLoading && <p className="tw-location-empty">Энэ шүүлтүүрт тохирох байршилтай зар алга.</p>}</div>}
    <small className="tw-location-footnote">Газрын зурагт зөвхөн координат оруулсан зарууд харагдана. “Надад ойр” нь байршлын зөвшөөрөлтэй үед ажиллана. Таны одоогийн байршлыг серверт хадгалахгүй.</small>
  </div>;
}
