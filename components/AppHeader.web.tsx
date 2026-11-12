import React, { useContext, type ReactNode } from 'react';
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
  return <div className="tw-shell tw-web-page-header">
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
