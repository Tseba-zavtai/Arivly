import React, { useState } from 'react';
import { Link, usePathname, type Href } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useJobs } from '@/contexts/JobsContext';
import type { HomePageContent } from '@/lib/homePageContent';
import WebHeaderDisclosure from './WebHeaderDisclosure';

export default function WebHeader({page}:{page:HomePageContent}) {
  const {isAuthenticated,isSuperAdmin}=useAuth();
  const {unreadRentalRequestNotificationCount}=useJobs();
  const pathname=usePathname();
  const [open,setOpen]=useState(false);
  return <header className="tw-header">
    <Link href="/" className="tw-logo" aria-label={`${page.header.logoAlt} нүүр`}><img src={page.header.logoUrl} alt={page.header.logoAlt} /></Link>
    <button className="tw-menu-toggle" aria-label="Үндсэн цэс нээх" aria-expanded={open} aria-controls="web-main-navigation" onClick={()=>setOpen(value=>!value)}>☰</button>
    <nav id="web-main-navigation" className={`tw-navigation ${open?'is-open':''}`} aria-label="Үндсэн цэс">
      {page.header.links.filter(link=>link.enabled).map(link=>{
        const href=link.href==='/my-jobs' && !isAuthenticated?'/auth':link.href;
        if (href.startsWith('/#')) return <a key={link.id} href={href} onClick={event => {
          setOpen(false);
          if (pathname !== '/') return;
          event.preventDefault();
          const hash = href.slice(1);
          if (window.location.hash === hash) window.dispatchEvent(new Event('hashchange'));
          else window.location.hash = hash;
        }}>{link.label}</a>;
        return href.startsWith('/')?<Link key={link.id} href={href as Href} onPress={()=>setOpen(false)} className={pathname===link.href?'is-active':''}>{link.label}</Link>:<a key={link.id} href={href} target="_blank" rel="noopener noreferrer" onClick={()=>setOpen(false)}>{link.label}</a>;
      })}
      {isSuperAdmin && <Link href={'/admin-home' as Href} className="tw-menu-admin" onPress={()=>setOpen(false)}>Нүүр засах</Link>}
    </nav>
    <div className="tw-header-actions">
      {isSuperAdmin && <Link href={'/admin-home' as Href} className="tw-login tw-admin-link">Нүүр засах</Link>}
      <Link href={isAuthenticated?'/saved-jobs':'/auth'} className="tw-nav-icon" aria-label="Хадгалсан зарууд">♡</Link>
      <Link href={isAuthenticated?'/rental-requests':'/auth'} className="tw-request-link">Хүсэлт{isAuthenticated && unreadRentalRequestNotificationCount>0?` (${unreadRentalRequestNotificationCount})`:''}</Link>
      <WebHeaderDisclosure label="MN" icon={<img className="tw-header-flag" src="/vendor/flag-icons/mn.svg" alt="" />}>
        <strong>Хэл</strong>
        <span className="tw-current-language">Монгол <span aria-label="Сонгосон">✓</span></span>
      </WebHeaderDisclosure>
      <WebHeaderDisclosure label={isAuthenticated ? 'Профайл' : 'Нэвтрэх'}>
        <strong>{isAuthenticated ? 'Миний бүртгэл' : 'Тавтай морилно уу'}</strong>
        <Link href={isAuthenticated ? '/profile' : '/auth'} className="tw-button tw-button-small">
          {isAuthenticated ? 'Профайл харах' : 'Нэвтрэх эсвэл бүртгүүлэх'}
        </Link>
        <Link href="/help" className="tw-header-help">Тусламж</Link>
      </WebHeaderDisclosure>
      <Link href={isAuthenticated?'/post':'/auth'} className="tw-button tw-button-small">＋ Зар нэмэх</Link>
    </div>
  </header>;
}
