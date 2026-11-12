import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { useJobs } from '@/contexts/JobsContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCategoryCatalogImmediately, loadCachedCategoryCatalog, refreshCategoryCatalog, type CatalogSubcategory } from '@/lib/categoryCatalog';
import { isListingExpired } from '@/lib/listingLifecycle';
import { searchMatch } from '@/lib/searchUtils';
import { buildHomeFeed, HOME_FEED_RECOMMENDATION_COPY, savedInterestScorer } from '@/lib/homeFeed';
import { isSponsoredPromotionActive } from '@/lib/promotionMetrics';
import type { Job } from '@/mocks/jobs';
import InstallWebApp from './InstallWebApp';
import usePublishedHomePage from './usePublishedHomePage';
import { DEFAULT_HOME_PAGE, normalizeHomePage, safeHomeLink, type HomeBlock, type HomePageContent } from '@/lib/homePageContent';
import WebLocationExplorer from './WebLocationExplorer';
import WebHomeCampaigns, { WebSeasonalCollections } from './WebHomeCampaigns';
import WebHomeAnnouncement from './WebHomeAnnouncement';
import WebHomeRail from './WebHomeRail';
import WebCategoryMenu from './WebCategoryMenu';
import ListingCard from './WebListingCard';
import WebListingGrid from './WebListingGrid';
import WebHomeFooter from './WebHomeFooter';

const symbols = ['⌂', '↗', '✧', '▣', '◉', '▤', '⚒', '✳', '♧', '△', '◎', '▥', '▧', '◫'];
const defaultCatalog = DEFAULT_HOME_PAGE.sections.find(block => block.type === 'catalog');
function ContentButton({block}:{block:HomeBlock}) {
  const href=safeHomeLink(block.buttonHref);
  if(!block.buttonLabel || !href) return null;
  return href.startsWith('/') ? <Link className="tw-button" href={href as any}>{block.buttonLabel}</Link> : <a className="tw-button" href={href} target="_blank" rel="noopener noreferrer">{block.buttonLabel}</a>;
}

export default function WebHome({contentOverride}:{contentOverride?:HomePageContent}) {
  const published=usePublishedHomePage(!contentOverride);
  const page=useMemo(()=>normalizeHomePage(contentOverride ?? published),[contentOverride,published]);
  const router = useRouter();
  const { jobs, isLoading, savedJobIds, toggleSaveJob, loadJobs } = useJobs();
  const { isAuthenticated } = useAuth();
  const [categories, setCategories] = useState(() => getCategoryCatalogImmediately().categories);
  const [query, setQuery] = useState('');
  const [category, setCategoryName] = useState('');
  const [subcategory, setSubcategory] = useState<CatalogSubcategory>();
  const setCategory = (name: string, sub?: CatalogSubcategory) => {
    setCategoryName(name);
    setSubcategory(sub);
  };
  const [sort, setSort] = useState('recent');
  const [limit, setLimit] = useState(12);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [mapOpen,setMapOpen]=useState(()=>typeof window!=='undefined' && window.location.hash==='#locations');
  useEffect(()=>{
    const scrollToHash=()=>{
      const hash=window.location.hash;
      if(hash==='#locations')setMapOpen(true);
      if(hash==='#locations'||hash==='#how-it-works')requestAnimationFrame(()=>document.getElementById(hash.slice(1))?.scrollIntoView({behavior:'smooth',block:'start'}));
    };
    scrollToHash();window.addEventListener('hashchange',scrollToHash);
    return()=>window.removeEventListener('hashchange',scrollToHash);
  },[]);
  useEffect(()=>{if(mapOpen && window.location.hash==='#locations')requestAnimationFrame(()=>document.getElementById('locations')?.scrollIntoView({behavior:'smooth',block:'start'}));},[mapOpen]);
  const catalogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (catalogOpen) catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [catalogOpen]);
  useEffect(() => {
    let active = true;
    void loadCachedCategoryCatalog().then(snapshot => { if (active) setCategories(snapshot.categories); });
    void refreshCategoryCatalog().then(snapshot => { if (active) setCategories(snapshot.categories); }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => { setLimit(12); }, [category, subcategory, query, sort]);
  const homeFeeds = useMemo(() => buildHomeFeed(jobs, {
    limit: Math.max(8, jobs.length),
    isEligible: job => job.isActive !== false && job.is_active !== false
      && !job.deleted_at && !isListingExpired(job)
      && (job.postType ?? 'job') === 'job' && (job.available_quantity ?? job.quantity ?? 1) > 0,
    isSponsored: isSponsoredPromotionActive,
    getCreatedAt: job => job.published_at ?? job.postedDate,
    getUpdatedAt: job => job.postedDate,
    getPersonalScore: savedInterestScorer(jobs, savedJobIds),
  }), [jobs, savedJobIds]);
  const categoryId = categories.find(item => item.name === category)?.id;
  const listings = useMemo(() => jobs.filter(job => {
    if (job.isActive === false || job.is_active === false || job.deleted_at || isListingExpired(job)) return false;
    if ((job.postType ?? 'job') !== 'job') return false;
    if (category && job.category !== category && (!categoryId || job.category_id !== categoryId)) return false;
    if (subcategory && job.subcategory_id !== subcategory.id && job.subcategory !== subcategory.name) return false;
    return !query.trim() || [job.title, job.description, job.category, job.subcategory, job.location?.address].some(field => searchMatch(String(field ?? ''), query.trim()));
  }).sort((a, b) => {
    if (sort === 'price-low' || sort === 'price-high') {
      const amount = (job: Job) => { const p = Number(String(job.price ?? '').replace(/,/g, '')); return p > 0 ? p : null; };
      const pa = amount(a), pb = amount(b);
      if (pa === null) return pb === null ? 0 : 1;
      if (pb === null) return -1;
      return sort === 'price-low' ? pa - pb : pb - pa;
    }
    const timestamp = (job: Job) => Math.max(new Date(job.published_at ?? job.postedDate ?? 0).getTime() || 0, new Date(job.bumped_at ?? job.bumpedAt ?? 0).getTime() || 0);
    return timestamp(b) - timestamp(a);
  }), [jobs, category, categoryId, subcategory, query, sort]);
  const browse = () => {
    if (catalogOpen) catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else setCatalogOpen(true);
  };
  const save = (id: string) => {
    if (contentOverride) return;
    if (!isAuthenticated) { router.push('/auth'); return; }
    void toggleSaveJob(id);
  };
  const discoveryRows = [
    { feed: homeFeeds.sponsored, title: 'Sponsored зарууд' },
    { feed: homeFeeds.recommended, title: 'Танд санал болгох',
      subtitle: HOME_FEED_RECOMMENDATION_COPY[homeFeeds.recommended.recommendationMode ?? 'empty'] },
    { feed: homeFeeds.newest, title: 'Шинэ зарууд' },
  ];
  const listingCard = (job: Job) => <ListingCard key={job.id} job={job} saved={savedJobIds.includes(job.id)} onSave={() => save(job.id)} />;
  const discovery = <>
    <WebSeasonalCollections preview={!!contentOverride} />
    {discoveryRows.map(({ feed, title, subtitle }) => !feed.isEmpty && (
      <WebHomeRail key={feed.kind} title={title} subtitle={subtitle} allItems={feed.items.map(listingCard)}>
        {feed.items.slice(0, 8).map(listingCard)}
      </WebHomeRail>
    ))}
    <WebHomeCampaigns />
  </>;

  const renderBlock=(block:HomeBlock) => {
    switch(block.type) {
      case 'hero': return (<section className="tw-hero">
      <div className="tw-hero-copy">
        <span className="tw-eyebrow"><i /> {block.eyebrow}</span>
        <h1>{block.title}{block.accent && <><br /><em>{block.accent}</em></>}</h1>
        <p>{block.body}</p>
        <form className="tw-search" role="search" onSubmit={event => { event.preventDefault(); browse(); }}>
          <span aria-hidden="true">⌕</span>
          <input aria-label="Түрээсийн зар хайх" placeholder="Юу түрээслэх вэ?" value={query} onChange={event => setQuery(event.target.value)} />
          <button type="submit" aria-label="Хайх">{block.buttonLabel || 'Хайх ↗'}</button>
        </form>
        <div className="tw-popular"><span>Ангиллаар:</span>{['Багаж, тоног төхөөрөмж', 'Аялал, зугаалгын хэрэгсэл', 'Технологи, төхөөрөмж'].map(name => <button key={name} onClick={() => { setCategory(name); browse(); }}>{name.split(',')[0]}</button>)}</div>
      </div>
      {block.imageUrl ? <div className="tw-hero-custom-image"><img src={block.imageUrl} alt={block.title} /></div> : <>       <div className="tw-hero-art" aria-hidden="true">
        <div className="tw-orbit tw-orbit-one" /><div className="tw-orbit tw-orbit-two" />
        <div className="tw-art-label">Бага эзэмш.<br />Ихийг бүтээ.</div>
        <div className="tw-object tw-object-camera"><svg viewBox="0 0 240 180"><path d="M30 55h40l13-20h65l15 20h40q17 0 17 17v76q0 17-17 17H30q-17 0-17-17V72q0-17 17-17" fill="#302638"/><rect x="25" y="70" width="185" height="25" rx="4" fill="#584365"/><circle cx="120" cy="108" r="49" fill="#17151e" stroke="#72627f" strokeWidth="7"/><circle cx="120" cy="108" r="33" fill="#463b64" stroke="#a79abd" strokeWidth="4"/><circle cx="120" cy="108" r="23" fill="#17182c"/><circle cx="110" cy="99" r="9" fill="#b5a1d8" opacity=".65"/><rect x="172" y="63" width="26" height="13" rx="3" fill="#ded5ea"/></svg></div>
        <div className="tw-object tw-object-bike">
          <svg viewBox="0 0 240 155">
            <g fill="#f0e7f7" stroke="#302439" strokeWidth="8">
              <circle cx="46" cy="113" r="31" /><circle cx="193" cy="113" r="31" />
            </g>
            <path d="M46 113l40-50 36 48 35-53-71 5m36 48H46" fill="none" stroke="#8053a0" strokeWidth="8" strokeLinejoin="round" />
            <path d="M193 113l-36-55-5-28 20-5M86 63l-7-18" fill="none" stroke="#3c3048" strokeWidth="7" strokeLinecap="round" />
            <path d="M61 43h39m60-17h19" fill="none" stroke="#302439" strokeWidth="8" strokeLinecap="round" />
            <path d="M96 68l46-4-20 38z" fill="#593579" stroke="#463054" strokeWidth="4" strokeLinejoin="round" />
            <path d="M119 72l-8 11h7l-3 10 12-14h-7l4-7z" fill="#f2e1ff" />
            <circle cx="46" cy="113" r="5" fill="#8053a0" /><circle cx="193" cy="113" r="5" fill="#8053a0" />
          </svg>
        </div>
        <div className="tw-object tw-object-tent"><svg viewBox="0 0 200 160"><path d="M12 140 100 14l87 126Z" fill="#d8b0ed"/><path d="m100 14 36 126H12Z" fill="#b17ad1"/><path d="m100 65 24 75H53Z" fill="#59316e"/><path d="M5 145h188" stroke="#75418b" strokeWidth="5" strokeLinecap="round"/><path d="m92 5 16 18M108 5 92 23" stroke="#75418b" strokeWidth="4"/></svg></div>
        <div className="tw-art-tag tw-art-tag-one">↗ Шинэ зүйл турш</div><div className="tw-art-tag tw-art-tag-two">♡ Илүү ухаалаг хэрэглээ</div>
      </div> </>}
    </section>);
      case 'categories': return (<section className="tw-section tw-category-section">
      <div className="tw-section-heading"><div><span className="tw-eyebrow">{block.eyebrow}</span><h2>{block.title}</h2></div><button className="tw-text-button" onClick={browse}>{block.buttonLabel || 'Бүх зар харах ↗'}</button></div>
      <div className="tw-category-grid">{categories.map((item, index) => <button type="button" className={`tw-category-tile ${category === item.name ? 'is-active' : ''}`} key={item.id} onClick={() => { setCategory(item.name); browse(); }}><span className="tw-category-symbol" aria-hidden="true">{symbols[index % symbols.length]}</span><span>{item.name}</span><span className="tw-tile-arrow" aria-hidden="true">↗</span></button>)}</div>
    </section>);
      case 'catalog': return catalogOpen && (<section className="tw-section tw-catalog" ref={catalogRef} aria-label="Түрээсийн зарууд">
      <div className="tw-section-heading"><h2>{subcategory?.name || category || (query.trim() ? 'Хайлтын үр дүн' : 'Бүх зар')}</h2><button type="button" className="tw-text-button" onClick={() => { setCategory(''); setQuery(''); }}>Бүх зар ↗</button></div>
      <div className="tw-filter-row"><label className="tw-sort">Эрэмбэлэх <select aria-label="Зар эрэмбэлэх" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Сүүлд нэмэгдсэн</option><option value="price-low">Үнэ: багаас их</option><option value="price-high">Үнэ: ихээс бага</option></select></label></div>
      {(category || query) && <div className="tw-applied-filters">{category && <button onClick={() => setCategory(subcategory ? category : '')}>{subcategory?.name || category} ×</button>}{query && <button onClick={() => setQuery('')}>“{query}” ×</button>}</div>}
      <p className="tw-result-count" aria-live="polite">{isLoading ? 'Заруудыг шинэчилж байна…' : `${listings.length} зар`}</p>
      {listings.length > 0 ? <WebListingGrid>{listings.slice(0, limit).map(listingCard)}</WebListingGrid> : isLoading ? <div className="tw-listing-grid" aria-label="Зарууд ачаалж байна">{Array.from({ length: 4 }, (_, i) => <div key={i} className="tw-skeleton" />)}</div> : <div className="tw-empty"><span>⌕</span><h3>Одоогоор тохирох зар алга</h3><p>Өөр үгээр хайх эсвэл ангиллын шүүлтүүрээ өөрчлөөрэй.</p><button className="tw-button" onClick={() => { setQuery(''); setCategory(''); void loadJobs(); }}>Заруудыг дахин харах</button></div>}
      {listings.length > limit && <button className="tw-load-more" onClick={() => setLimit(value => value + 12)}>Дараагийн заруудыг харах ↓</button>}
    </section>);
      case 'promo': return (<section className="tw-owner-banner"><div><span className="tw-eyebrow">{block.eyebrow}</span><h2>{block.title}</h2><p>{block.body}</p><ContentButton block={block} /></div>{block.imageUrl ? <img className="tw-content-image" src={block.imageUrl} alt="" /> : <div className="tw-owner-graphic" aria-hidden="true"><span>↗</span><div>Илүү боломж.<br /><b>Илүү Arivly.</b></div></div>}</section>);
      case 'steps': return (<section className="tw-section tw-how"><span className="tw-eyebrow">{block.eyebrow}</span><h2>{block.title}</h2><div className="tw-steps">{block.body.split("\n").filter(Boolean).map((line,index) => { const [title,...description] = line.split("|"); return <div key={index}><span>{String(index+1).padStart(2,"0")}</span><h3>{title}</h3><p>{description.join("|")}</p></div>; })}</div></section>);
      case 'text': return (<section className="tw-section tw-content-text"><span className="tw-eyebrow">{block.eyebrow}</span><h2>{block.title}</h2><p>{block.body}</p>{block.imageUrl && <img className="tw-content-image" src={block.imageUrl} alt="" />}<ContentButton block={block} /></section>);
      case 'benefits': return (<div className="tw-benefits">{block.body.split("\n").filter(Boolean).map((line,index)=><span key={index}>{line}</span>)}</div>);
    }
  };
  const locationSection=<section id="locations" className="tw-section tw-location-section"><div className="tw-section-heading"><div><span className="tw-eyebrow">Танд ойрхон боломжууд</span><h2>{page.header.locationTitle}</h2></div><button className="tw-text-button" type="button" onClick={()=>setMapOpen(value=>!value)} aria-expanded={mapOpen}>{mapOpen?'Газрын зураг хураах ↑':'Газрын зураг нээх ↗'}</button></div>{mapOpen && <WebLocationExplorer preview={!!contentOverride} />}</section>;
  const firstHero=page.sections.find(item=>item.enabled && item.type==='hero')?.id;
  const catalog = page.sections.find(block => block.enabled && block.type === 'catalog');
  return <div className="tw-home">
    {!contentOverride && <><WebHomeAnnouncement /><InstallWebApp /></>}
    <WebCategoryMenu categories={categories} selected={category} onSelect={(name, sub) => {
      setCategory(name, sub);
      browse();
    }} />
    {!firstHero && <>{discovery}{locationSection}</>}
    {page.sections.filter(block => block.enabled && (block.type !== 'catalog' || block === catalog)).map(block=><React.Fragment key={block.id}>{renderBlock(block)}{block.id===firstHero && <>{discovery}{locationSection}</>}</React.Fragment>)}
    {!catalog && defaultCatalog && renderBlock(defaultCatalog)}
    <WebHomeFooter page={page} onBrowse={() => {
      setQuery('');
      setCategory('');
      browse();
    }} />
  </div>;
}
