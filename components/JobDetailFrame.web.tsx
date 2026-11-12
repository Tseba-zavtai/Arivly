import React, { type ReactNode } from 'react';
import { Link } from 'expo-router';
import WebShell from './web/WebShell';

export default function JobDetailFrame({ children }: { children: ReactNode }) {
  return <WebShell>
    <div className="tw-detail-frame">
      <Link href="/" className="tw-text-button tw-detail-back">← Нүүр</Link>
      {children}
    </div>
  </WebShell>;
}
