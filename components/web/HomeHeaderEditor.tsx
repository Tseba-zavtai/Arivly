import React from 'react';
import { safeHomeImage, safeHomeLink, type HomeHeader, type HomeMenuLink } from '@/lib/homePageContent';
import { uploadHomeImage } from '@/lib/homePageStore';

export default function HomeHeaderEditor({value,onChange,onBusy,onError}:{value:HomeHeader;onChange:(value:HomeHeader)=>void;onBusy:(busy:boolean)=>void;onError:(message:string)=>void}) {
  const update=(patch:Partial<HomeHeader>)=>onChange({...value,...patch});
  const menu=(index:number,patch:Partial<HomeMenuLink>)=>update({links:value.links.map((item,i)=>i===index?{...item,...patch}:item)});
  const move=(index:number,direction:number)=>{const links=[...value.links],target=index+direction;if(target<0||target>=links.length)return;[links[index],links[target]]=[links[target],links[index]];update({links});};
  return <div className="tw-cms-header-fields"><h2>Лого, үндсэн цэс</h2>
    <label>Лого оруулах<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async event=>{
      const file=event.target.files?.[0];if(!file)return;const input=event.target;onBusy(true);onError('');
      try{const logoUrl=await uploadHomeImage(file);update({logoUrl});}catch(cause){onError(cause instanceof Error?cause.message:'Лого оруулж чадсангүй.');}finally{onBusy(false);input.value='';}
    }}/></label>
    <label>Эсвэл логогийн хаяг<input value={value.logoUrl} onChange={event=>update({logoUrl:event.target.value})} /></label>
    {value.logoUrl && !safeHomeImage(value.logoUrl) && <p className="tw-cms-error">PNG, JPG, WebP зургийн HTTPS хаяг оруулна уу.</p>}
    {safeHomeImage(value.logoUrl) && <img className="tw-cms-logo-preview" src={safeHomeImage(value.logoUrl)} alt={value.logoAlt} />}
    <label>Логогийн нэр<input maxLength={80} value={value.logoAlt} onChange={event=>update({logoAlt:event.target.value})}/></label>
    <h2>Үндсэн цэсний холбоосууд</h2>
    {value.links.map((link,index)=><div className="tw-cms-menu-item" key={link.id}>
      <label className="tw-cms-checkbox"><input type="checkbox" checked={link.enabled} onChange={event=>menu(index,{enabled:event.target.checked})}/>Харуулах</label>
      <label>Цэсний бичиг<input maxLength={80} value={link.label} onChange={event=>menu(index,{label:event.target.value})}/></label>
      <label>Очих хаяг<input value={link.href} onChange={event=>menu(index,{href:event.target.value})}/></label>
      {(!link.label.trim() || !safeHomeLink(link.href)) && <p className="tw-cms-error">Цэсний нэр болон зөв холбоос оруулна уу.</p>}
      <div className="tw-cms-menu-buttons"><button type="button" disabled={index===0} aria-label={`${link.label} цэс дээш`} onClick={()=>move(index,-1)}>↑</button><button type="button" disabled={index===value.links.length-1} aria-label={`${link.label} цэс доош`} onClick={()=>move(index,1)}>↓</button><button type="button" onClick={()=>update({links:value.links.filter((_,i)=>i!==index)})}>Цэснээс хасах</button></div>
    </div>)}
    <button type="button" disabled={value.links.length>=8} onClick={()=>update({links:[...value.links,{id:`menu-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,label:'Шинэ цэс',href:'/',enabled:true}]})}>＋ Цэс нэмэх</button>
    <p>Байршлын хэсэг: /#locations<br/>Хэрхэн ажилладаг вэ: /#how-it-works<br/>Нөхцөлийн хуудас: /help/terms</p>
    <label>Газрын зургийн хэсгийн гарчиг<input maxLength={200} value={value.locationTitle} onChange={event=>update({locationTitle:event.target.value})}/></label>
  </div>;
}
