import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { safeHomeImage } from '@/lib/homePageContent';

type Announcement = { id: string; title: string; message: string; image_url: string | null };
const dismissalKey = (id: string) => `tureesly-web-announcement:${id}`;

function wasDismissed(id: string) {
  try { return localStorage.getItem(dismissalKey(id)) === '1'; }
  catch { return false; }
}

export default function WebHomeAnnouncement() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismiss, setDismiss] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const now = new Date().toISOString();
    async function load() {
      const { data, error } = await supabase.from('system_announcements')
        .select('id,title,message,image_url')
        .eq('is_active', true)
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`end_at.is.null,end_at.gte.${now}`)
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal);
      if (controller.signal.aborted) return;
      if (error) {
        console.warn('Unable to load home announcements', error.message);
        return;
      }
      setAnnouncement((data ?? []).find(item => !wasDismissed(item.id)) ?? null);
    }
    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, [announcement]);

  if (!announcement) return null;
  const image = safeHomeImage(announcement.image_url);
  return (
    <dialog className="tw-system-announcement" ref={dialog} aria-labelledby="tw-system-announcement-title"
      onClose={() => setAnnouncement(null)}>
      <h2 id="tw-system-announcement-title">{announcement.title}</h2>
      {image && <img src={image} alt="" />}
      <p>{announcement.message}</p>
      <form method="dialog" onSubmit={() => {
        if (dismiss) {
          try { localStorage.setItem(dismissalKey(announcement.id), '1'); }
          catch { /* The dialog can still be closed when storage is unavailable. */ }
        }
      }}>
        <label><input type="checkbox" checked={dismiss} onChange={event => setDismiss(event.target.checked)} /> Дахиж харуулахгүй</label>
        <button className="tw-button tw-button-small" type="submit">Баярлалаа</button>
      </form>
    </dialog>
  );
}
