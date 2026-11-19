import React, { useState } from 'react';
import { Link, usePathname, useRouter, type Href } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useJobs } from '@/contexts/JobsContext';
import type { HomePageContent } from '@/lib/homePageContent';
import WebHeaderDisclosure from './WebHeaderDisclosure';

const hiddenHeaderLinks = new Set(['/my-jobs', '/#how-it-works', '/#locations']);

export default function WebHeader({page}:{page:HomePageContent}) {
  const {isAuthenticated,isSuperAdmin,user,logout}=useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError('');
    try { await logout(); router.replace('/'); }
    catch { setLogoutError('Гарч чадсангүй. Дахин оролдоно уу.'); }
    finally { setLoggingOut(false); }
  };
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const name = user?.name?.trim() || 'Хэрэглэгч';
  const avatar = <span className="tw-account-avatar" aria-hidden="true">
    {user?.photoUri && user.photoUri !== failedPhoto
      ? <img src={user.photoUri} alt="" onError={() => setFailedPhoto(user.photoUri)} />
      : name.slice(0, 1).toLocaleUpperCase('mn')}
  </span>;
  const {unreadRentalRequestNotificationCount}=useJobs();
  const pathname=usePathname();
  const [open,setOpen]=useState(false);
  const links = page.header.links.filter(link => link.enabled && !hiddenHeaderLinks.has(link.href));
  return <header className="tw-header">
    <Link href="/" className="tw-logo" aria-label={`${page.header.logoAlt} нүүр`}><img src={page.header.logoUrl} alt={page.header.logoAlt} /></Link>
    {(links.length > 0 || isSuperAdmin) && <>
    <button className="tw-menu-toggle" aria-label="Үндсэн цэс нээх" aria-expanded={open} aria-controls="web-main-navigation" onClick={()=>setOpen(value=>!value)}>☰</button>
    <nav id="web-main-navigation" className={`tw-navigation ${open?'is-open':''}`} aria-label="Үндсэн цэс">
      {links.map(link=>{
        const {href}=link;
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
    </>}
    <div className="tw-header-actions">
      {isSuperAdmin && <Link href={'/admin-home' as Href} className="tw-login tw-admin-link">Нүүр засах</Link>}
      <Link href={isAuthenticated?'/saved-jobs':'/auth'} className="tw-nav-icon" aria-label="Хадгалсан зарууд">♡</Link>
      <Link href={isAuthenticated?'/rental-requests':'/auth'} className="tw-request-link">Хүсэлт{isAuthenticated && unreadRentalRequestNotificationCount>0?` (${unreadRentalRequestNotificationCount})`:''}</Link>
      <WebHeaderDisclosure label="MN" icon={<img className="tw-header-flag" src="/vendor/flag-icons/mn.svg" alt="" />}>
        <strong>Хэл</strong>
        <span className="tw-current-language">Монгол <span aria-label="Сонгосон">✓</span></span>
      </WebHeaderDisclosure>
      <WebHeaderDisclosure label={isAuthenticated ? name : 'Профайл'} icon={isAuthenticated ? avatar : undefined}>
        {isAuthenticated ? <>
          <Link href="/profile" className="tw-account-summary">
            {avatar}<span><strong>{name}</strong>{user?.phone && <small>{user.phone}</small>}<small>Нэвтэрсэн</small></span>
          </Link>
          <Link href="/my-jobs" className="tw-header-help">Миний зарууд</Link>
          <Link href="/saved-jobs" className="tw-header-help">Хадгалсан зарууд</Link>
        </> : <>
          <strong>Тавтай морилно уу</strong>
          <Link href="/auth" className="tw-button tw-button-small">Нэвтрэх эсвэл бүртгүүлэх</Link>
        </>}
        {isAuthenticated ? <>
          <button type="button" className="tw-header-help tw-account-logout" disabled={loggingOut} onClick={() => void handleLogout()}>{loggingOut ? 'Гарч байна…' : 'Гарах'}</button>
          {logoutError && <span role="alert">{logoutError}</span>}
        </> : <Link href="/help" className="tw-header-help">Тусламж</Link>}
      </WebHeaderDisclosure>
      <Link href={isAuthenticated?'/post':'/auth'} className="tw-button tw-button-small">＋ Зар нэмэх</Link>
    </div>
  </header>;
}
