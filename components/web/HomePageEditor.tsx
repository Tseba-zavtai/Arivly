import React, { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_HOME_PAGE, HOME_BLOCK_LABELS, HOME_SOCIAL_KEYS, HOME_SOCIAL_LABELS, HOME_STORE_KEYS, HOME_STORE_LABELS, newHomeBlock, normalizeHomePage, normalizeStoreRating, safeHomeImage, safeHomeLink, safeHomeSocialLink, type HomeBlock, type HomeBlockType, type HomePageContent } from '@/lib/homePageContent';
import { readHomePage, saveHomeDraft, publishHomeDraft, uploadHomeImage } from '@/lib/homePageStore';
import WebHome from './WebHome';
import './web.css';
import './editor.css';
import { useQueryClient } from '@tanstack/react-query';
import HomeHeaderEditor from './HomeHeaderEditor';
import WebHeader from './WebHeader';

export default function HomePageEditor() {
  const queryClient = useQueryClient();
  const { isSuperAdmin, isAdminUnlocked, isLoading, unlockAdmin, isAuthenticated } = useAuth();
  const [password, setPassword] = useState('');
  const [content, setContent] = useState<HomePageContent>(() => normalizeHomePage(DEFAULT_HOME_PAGE));
  const [saved, setSaved] = useState('');
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState('hero');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [addType, setAddType] = useState<HomeBlockType>('text');
  const allowed = isSuperAdmin && isAdminUnlocked;
  const dirty = ready && JSON.stringify(content) !== saved;
  const block = content.sections.find(item => item.id === selected);
  useEffect(() => {
    if (!allowed) return;
    let current = true;
    readHomePage('draft').then(record => {
      if (!current) return;
      setContent(record.content); setSaved(JSON.stringify(record.content)); setRevision(record.revision);
      setSelected(record.content.sections[0]?.id ?? ''); setReady(true);
    }).catch(cause => { if (current) setError(cause.message); });
    return () => { current = false; };
  }, [allowed]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function updateBlock(update: Partial<HomeBlock>) {
    setContent(previous => ({ ...previous, sections: previous.sections.map(item => item.id === selected ? { ...item, ...update } : item) }));
  }
  function move(id: string, direction: number) {
    setContent(previous => {
      const sections = [...previous.sections]; const from = sections.findIndex(item => item.id === id), to = from + direction;
      if (from < 0 || to < 0 || to >= sections.length) return previous;
      [sections[from], sections[to]] = [sections[to], sections[from]];
      return { ...previous, sections };
    });
  }
  async function save(publish: boolean) {
    setBusy(true); setError(''); setMessage('');
    try {
      if (content.sections.some(item => (item.imageUrl && !safeHomeImage(item.imageUrl)) || (item.buttonHref && !safeHomeLink(item.buttonHref)))) {
        throw new Error('Зураг эсвэл товчны хаяг буруу байна. Тэмдэглэсэн талбаруудыг засаад хадгалаарай.');
      }
      if (!safeHomeImage(content.header.logoUrl) || content.header.links.some(link=>!link.label.trim() || !safeHomeLink(link.href))) throw new Error('Лого, үндсэн цэсний нэр болон холбоосоо шалгаарай.');
      for (const platform of HOME_SOCIAL_KEYS) {
        const url = content.socialLinks?.[platform];
        if (url?.trim() && !safeHomeSocialLink(platform, url)) {
          throw new Error(`${HOME_SOCIAL_LABELS[platform]}-ийн HTTPS холбоосыг шалгаарай.`);
        }
      }
      for (const store of HOME_STORE_KEYS) {
        const rating = content.storeRatings?.[store];
        if (rating && (Number.isFinite(rating.count) || Number.isFinite(rating.average)) && !normalizeStoreRating(rating)) {
          throw new Error(`${HOME_STORE_LABELS[store]}-ийн үнэлгээний тоо, дунджийг шалгаарай.`);
        }
      }
      const normalized = normalizeHomePage(content);
      let nextRevision = revision;
      if (JSON.stringify(normalized) !== saved) {
        nextRevision = await saveHomeDraft(normalized, revision);
        setRevision(nextRevision); setContent(normalized); setSaved(JSON.stringify(normalized));
      }
      if (publish) { await publishHomeDraft(nextRevision); await queryClient.invalidateQueries({ queryKey: ['published-web-home'] }); }
      setMessage(publish ? 'Нүүрийн шинэ хувилбар нийтлэгдлээ. Сайтыг дахин нээхэд харагдана.' : 'Ноорог хадгалагдлаа. Нийтийн нүүр өөрчлөгдөөгүй.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Хадгалж чадсангүй.'); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (!window.confirm('Нийтэлсэн хувилбарыг засварт нээх үү? Одоогийн хадгалаагүй өөрчлөлт солигдоно.')) return;
    setBusy(true); setError('');
    try { const published = await readHomePage('published'); setContent(published.content); setSelected(published.content.sections[0]?.id ?? ''); setMessage('Нийтэлсэн хувилбарыг нээлээ. Ноорог хадгалах товчоор хадгална.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Уншиж чадсангүй.'); }
    finally { setBusy(false); }
  }
  if (isLoading) return <div className="tw-cms-gate">Нэвтрэлтийг шалгаж байна…</div>;
  if (!isAuthenticated || !isSuperAdmin) return <div className="tw-cms-gate"><h1>Нүүрийн удирдлага</h1><p>Админ эрхтэй бүртгэлээрээ нэвтэрнэ үү.</p><Link href={isAuthenticated ? '/profile' : '/auth'}>Профайл / нэвтрэх →</Link></div>;
  if (!isAdminUnlocked) return <form className="tw-cms-gate" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { await unlockAdmin(password); setPassword(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Баталгаажуулж чадсангүй.'); } finally { setBusy(false); }
  }}><h1>Нүүрийн удирдлага</h1><p>Өөрийн нууц үгээ баталгаажуулж орно уу.</p><label>Нууц үг<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} /></label><button disabled={busy}>Нэвтрэх</button>{error && <p role="alert">{error}</p>}<Link href="/">Нүүр рүү буцах</Link></form>;

  return <div className={`tw-cms tw-cms-view-${view}`}>
    <header className="tw-cms-header"><div><Link href="/admin">← Админ</Link><h1>Нүүр засах</h1><span>{dirty ? 'Хадгалаагүй өөрчлөлттэй' : ready ? 'Ноорог хадгалагдсан' : 'Тохиргоог уншиж байна…'}</span></div><div className="tw-cms-actions"><button type="button" onClick={restore} disabled={busy || !ready}>Нийтэлснийг сэргээх</button><button type="button" disabled={!dirty || busy || !ready} onClick={() => save(false)}>Ноорог хадгалах</button><button className="tw-cms-publish" type="button" disabled={busy || !ready} onClick={() => save(true)}>{busy ? 'Түр хүлээнэ үү…' : 'Нийтлэх'}</button><Link href="/" target="_blank" rel="noopener">Сайт харах ↗</Link></div></header>
    <div className="tw-cms-notices" aria-live="polite">{message && <p className="tw-cms-message" role="status">{message}</p>}{error && <p className="tw-cms-error" role="alert">{error}</p>}</div>
    <div className="tw-cms-view-tabs"><button onClick={() => setView('edit')}>Засах</button><button onClick={() => setView('preview')}>Урьдчилж харах</button></div>
    <div className="tw-cms-workspace"><aside className="tw-cms-sidebar"><h2>Нүүрийн хэсгүүд</h2><p>Дарааллыг ↑ ↓ товчоор солино.</p><fieldset disabled={busy || !ready}>
      <button type="button" className={!block ? 'is-selected' : ''} onClick={() => setSelected('')}>Ерөнхий тохиргоо</button>
      {content.sections.map((item, index) => <div key={item.id} className={`tw-cms-block-row ${selected === item.id ? 'is-selected' : ''}`}><button type="button" onClick={() => setSelected(item.id)}><span>{item.enabled ? '●' : '○'} {HOME_BLOCK_LABELS[item.type]}</span><small>{item.title || 'Гарчиггүй'}</small></button><div><button type="button" disabled={index === 0} aria-label={`${HOME_BLOCK_LABELS[item.type]} дээш`} onClick={() => move(item.id, -1)}>↑</button><button type="button" disabled={index === content.sections.length - 1} aria-label={`${HOME_BLOCK_LABELS[item.type]} доош`} onClick={() => move(item.id, 1)}>↓</button></div></div>)}
      <label>Шинэ хэсэг<select value={addType} onChange={event => setAddType(event.target.value as HomeBlockType)}>{Object.entries(HOME_BLOCK_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" disabled={content.sections.length >= 40} onClick={() => { const item = newHomeBlock(addType); setContent(previous => ({ ...previous, sections: [...previous.sections, item] })); setSelected(item.id); }}>＋ Хэсэг нэмэх</button>
    </fieldset></aside>
    <section className="tw-cms-fields"><fieldset disabled={busy || !ready}>
      {block ? <><h2>{HOME_BLOCK_LABELS[block.type]}</h2><label className="tw-cms-checkbox"><input type="checkbox" checked={block.enabled} onChange={event => updateBlock({ enabled: event.target.checked })} />Нүүр дээр харуулах</label>
        <label>Жижиг дээд тайлбар<input value={block.eyebrow} maxLength={200} onChange={event => updateBlock({ eyebrow: event.target.value })} /></label>
        <label>Гарчиг<textarea rows={3} value={block.title} maxLength={300} onChange={event => updateBlock({ title: event.target.value })} /></label>
        {block.type === 'hero' && <label>Онцлох гарчиг<input value={block.accent} maxLength={300} onChange={event => updateBlock({ accent: event.target.value })} /></label>}
        <label>{block.type === 'steps' ? 'Алхамууд (мөр бүр: Гарчиг|Тайлбар)' : block.type === 'benefits' ? 'Давуу талууд (мөр бүрт нэг)' : 'Тайлбар'}<textarea rows={5} maxLength={4000} value={block.body} onChange={event => updateBlock({ body: event.target.value })} /></label>
        {['hero', 'promo', 'text'].includes(block.type) && <><label>Зураг оруулах<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async event => {
          const file = event.target.files?.[0]; if (!file) return; const targetId = block.id;
          setBusy(true); setError('');
          try { const url = await uploadHomeImage(file); setContent(previous => ({ ...previous, sections: previous.sections.map(item => item.id === targetId ? { ...item, imageUrl: url } : item) })); }
          catch (cause) { setError(cause instanceof Error ? cause.message : 'Зураг оруулж чадсангүй.'); }
          finally { setBusy(false); event.target.value = ''; }
        }} /></label><small>PNG, JPG, WebP · 5 MB хүртэл. Зураг оруулах нь нийтлэхгүй.</small><label>Эсвэл зургийн HTTPS хаяг<input type="url" value={block.imageUrl} onChange={event => updateBlock({ imageUrl: event.target.value })} /></label>{block.imageUrl && !safeHomeImage(block.imageUrl) && <p className="tw-cms-error">Зөв HTTPS зургийн хаяг оруулна уу.</p>}{safeHomeImage(block.imageUrl) && <img className="tw-cms-image" src={safeHomeImage(block.imageUrl)} alt="Сонгосон зураг" />}<button type="button" onClick={() => updateBlock({ imageUrl: '' })}>Зургийг хэсгээс авах</button></>}
        {block.type !== 'steps' && <label>Товчны бичиг<input value={block.buttonLabel} maxLength={100} onChange={event => updateBlock({ buttonLabel: event.target.value })} /></label>}
        {['promo', 'text'].includes(block.type) && <><label>Товчны очих хаяг<input value={block.buttonHref} placeholder="/post эсвэл https://…" onChange={event => updateBlock({ buttonHref: event.target.value })} /></label>{block.buttonHref && !safeHomeLink(block.buttonHref) && <p className="tw-cms-error">/ зам эсвэл HTTPS хаяг ашиглана уу.</p>}</>}
        <button type="button" className="tw-cms-delete" onClick={() => {
          if (!window.confirm('Энэ хэсгийг нооргоос авах уу? Нийтлэх хүртэл нийтийн нүүр өөрчлөгдөхгүй.')) return;
          setContent(previous => ({ ...previous, sections: previous.sections.filter(item => item.id !== selected) })); setSelected('');
        }}>Хэсгийг хасах</button>
      </> : <>
        <h2>Ерөнхий тохиргоо</h2>
        <label>Дээд туузны бичиг<input maxLength={300} value={content.announcement} onChange={event => setContent(previous => ({ ...previous, announcement: event.target.value }))} /></label>
        <label>Хөл хэсгийн тайлбар<input maxLength={300} value={content.footerText} onChange={event => setContent(previous => ({ ...previous, footerText: event.target.value }))} /></label>
        <h2>Сошиал холбоос</h2>
        <p>Албан ёсны хуудасныхаа HTTPS холбоосыг оруулаад нийтлээрэй.</p>
        {HOME_SOCIAL_KEYS.map(platform => <label key={platform}>{HOME_SOCIAL_LABELS[platform]}
          <input type="url" maxLength={500} value={content.socialLinks?.[platform] ?? ''}
            onChange={event => {
              const value = event.target.value;
              setContent(previous => ({ ...previous, socialLinks: { ...previous.socialLinks, [platform]: value } }));
            }} />
        </label>)}
        <h2>Дэлгүүрийн үнэлгээ</h2>
        <p>Хоёр дэлгүүрийн ижил хүрээний тоо, дунджийг оруулна. Нийлээд 100 үнэлгээнд хүрэхэд нүүрэнд гарна.</p>
        {HOME_STORE_KEYS.map(store => <fieldset key={store}>
          <legend>{HOME_STORE_LABELS[store]}</legend>
          {(['count', 'average'] as const).map(field => {
            const value = content.storeRatings?.[store]?.[field];
            return <label key={field}>{field === 'count' ? 'Үнэлгээний тоо' : 'Дундаж од'}
              <input type="number" min={0} max={field === 'average' ? 5 : undefined}
                step={field === 'average' ? 'any' : 1} value={Number.isFinite(value) ? value : ''}
                onChange={event => {
                  const next = event.target.valueAsNumber;
                  setContent(previous => ({
                    ...previous,
                    storeRatings: {
                      ...previous.storeRatings,
                      [store]: { count: NaN, average: NaN, ...previous.storeRatings?.[store], [field]: next },
                    },
                  }));
                }} />
            </label>;
          })}
        </fieldset>)}
        <HomeHeaderEditor value={content.header} onChange={header=>setContent(previous=>({...previous,header}))} onBusy={setBusy} onError={setError} />
      </>}
    </fieldset></section>
    <section className="tw-cms-preview-area"><div className="tw-cms-preview-toolbar"><b>Урьдчилсан харагдац</b><label><input type="checkbox" checked={mobilePreview} onChange={event => setMobilePreview(event.target.checked)} /> Утасны өргөн</label><small>Нийтлэх хүртэл зөвхөн танд харагдана. Холбоосууд эндээс өөр хуудас руу шилжихгүй.</small></div><div className={`tw-cms-preview tw-shell ${mobilePreview ? 'is-mobile' : ''}`} onClickCapture={event => {
      if ((event.target as Element).closest('a')) { event.preventDefault(); event.stopPropagation(); }
    }}>{content.announcement && <div className="tw-announcement">{content.announcement}</div>}<WebHeader page={content}/><WebHome contentOverride={content} /></div></section>
    </div>
  </div>;
}
