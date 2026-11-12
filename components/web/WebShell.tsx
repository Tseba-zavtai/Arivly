import React, { createContext } from 'react';
import { Link } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useJobs } from '@/contexts/JobsContext';
import WebHeader from './WebHeader';
import './web.css';
import usePublishedHomePage from './usePublishedHomePage';

export const WebShellContext = createContext(false);

export default function WebShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { unreadRentalRequestNotificationCount } = useJobs();
  const page = usePublishedHomePage();
  return <WebShellContext.Provider value={true}><div className="tw-shell">
    <a className="tw-skip" href="#main-content">Үндсэн хэсэг рүү</a>
    {page.announcement && <div className="tw-announcement">{page.announcement}</div>}
    <WebHeader page={page} />
    <main id="main-content" className="tw-main">{children}</main>
    <nav className="tw-mobile-nav" aria-label="Утасны цэс">
      <Link href="/">Нүүр</Link>
      <Link href={isAuthenticated ? '/saved-jobs' : '/auth'}>Хадгалсан</Link>
      <Link href={isAuthenticated ? '/post' : '/auth'}>＋ Зар нэмэх</Link>
      <Link href={isAuthenticated ? '/rental-requests' : '/auth'}>Хүсэлт{isAuthenticated && unreadRentalRequestNotificationCount > 0 ? ` (${unreadRentalRequestNotificationCount})` : ''}</Link>
      <Link href={isAuthenticated ? '/profile' : '/auth'}>Профайл</Link>
    </nav>
  </div></WebShellContext.Provider>;
}
