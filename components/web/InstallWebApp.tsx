import React, { useEffect, useState } from 'react';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export default function InstallWebApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [instructions, setInstructions] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone) return;
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const ready = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const installed = () => { setPrompt(null); setIos(false); setInstructions(false); };
    window.addEventListener('beforeinstallprompt', ready);
    window.addEventListener('appinstalled', installed);
    return () => { window.removeEventListener('beforeinstallprompt', ready); window.removeEventListener('appinstalled', installed); };
  }, []);
  if (!prompt && !ios) return null;
  return <aside className="tw-install">
    <span><b>Arivly үргэлж ойрхон.</b> Утасныхаа нүүр дэлгэцэд нэмээрэй.</span>
    <button type="button" onClick={async () => {
      if (prompt) { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }
      else setInstructions(value => !value);
    }}>Нүүр дэлгэцэд нэмэх ＋</button>
    {instructions && <p role="status">Safari-ийн хуваалцах (Share) цэсийг нээгээд “Add to Home Screen” → “Add” сонгоорой.</p>}
  </aside>;
}
