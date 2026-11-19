import React, { useContext, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import WebHeader from './web/WebHeader';
import { WebShellContext } from './web/WebShell';
import usePublishedHomePage from './web/usePublishedHomePage';
import './web/web.css';

export default function AppHeader({ title, showBack = true, rightAccessory }: {
  title?: string;
  showBack?: boolean;
  rightAccessory?: ReactNode;
}) {
  const insideShell = useContext(WebShellContext);
  const page = usePublishedHomePage(!insideShell);
  const router = useRouter();
  const header = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const page = header.current?.parentElement;
    if (!page) return;
    const canScroll = (element: HTMLElement, delta: number) => {
      const overflow = getComputedStyle(element).overflowY;
      return /auto|scroll/.test(overflow) && element.scrollHeight > element.clientHeight + 1
        && (delta > 0 ? element.scrollTop + element.clientHeight < element.scrollHeight - 1 : element.scrollTop > 0);
    };
    const scrollFromGutter = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.closest('dialog, [role="dialog"], .leaflet-container, textarea, select, input')) return;
      for (let element: HTMLElement | null = target; element && page.contains(element); element = element.parentElement) {
        if (canScroll(element, event.deltaY)) return;
      }
      const scrollArea = Array.from(page.querySelectorAll<HTMLElement>('*'))
        .filter(element => canScroll(element, event.deltaY) && element.getClientRects().length > 0)
        .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
      if (!scrollArea) return;
      event.preventDefault();
      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scrollArea.clientHeight : 1;
      scrollArea.scrollTop += event.deltaY * multiplier;
    };
    page.addEventListener('wheel', scrollFromGutter, { passive: false });
    return () => page.removeEventListener('wheel', scrollFromGutter);
  }, []);
  return <div ref={header} className="tw-shell tw-web-page-header">
    {!insideShell && <>
      {page.announcement && <div className="tw-announcement">{page.announcement}</div>}
      <WebHeader page={page} />
    </>}
    <div className="tw-web-page-title">
      {showBack && <button type="button" aria-label="Буцах" onClick={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }}>←</button>}
      {title && <strong>{title}</strong>}
      {rightAccessory && <div className="tw-web-page-accessory">{rightAccessory}</div>}
    </div>
  </div>;
}
