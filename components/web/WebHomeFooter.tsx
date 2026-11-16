import React, { useState } from 'react';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LockKeyhole, Smartphone } from 'lucide-react-native';
import { getCombinedStoreRating, HOME_SOCIAL_KEYS, HOME_SOCIAL_LABELS, safeHomeSocialLink, type HomePageContent, type HomeSocial } from '@/lib/homePageContent';
import { supabase } from '@/lib/supabase';

function SocialIcon({ platform }: { platform: HomeSocial }) {
  const icons = {
    facebook: <path d="M14 21v-8h3l.5-4H14V7c0-1 .3-2 2-2h2V2h-3c-3 0-5 2-5 5v2H7v4h3v8z" fill="currentColor" />,
    instagram: <g fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></g>,
    youtube: <><rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" /><path d="m10 8 6 4-6 4z" fill="#f4ecf8" /></>,
    linkedin: <path d="M5 8h3v12H5zM6.5 3a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zM11 8h3v2c1-1.5 2.1-2 3.5-2 2.6 0 4 1.5 4 4.5V20h-3v-6.5c0-1.7-.6-2.5-2-2.5-1.5 0-2.5 1-2.5 2.7V20h-3z" fill="currentColor" />,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">{icons[platform]}</svg>;
}
const appStore = 'https://apps.apple.com/mn/app/id6777877910';
const playStore = 'https://play.google.com/store/apps/details?id=mn.tureestei.app';
const publicHome = 'https://arivly.mn/';

export default function WebHomeFooter({ page, onBrowse }: { page: HomePageContent; onBrowse: () => void }) {
  const [shareStatus, setShareStatus] = useState('');
  const { data: facebook } = useQuery({
    queryKey: ['web-footer-facebook'],
    enabled: page.socialLinks?.facebook === undefined,
    queryFn: async () => {
      const { data } = await supabase.from('app_config').select('value').eq('key', 'facebook_url').maybeSingle();
      return safeHomeSocialLink('facebook', data?.value);
    },
    staleTime: 5 * 60_000,
  });
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const rating = getCombinedStoreRating(page.storeRatings);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Arivly', url: publicHome });
      } else {
        await navigator.clipboard.writeText(publicHome);
        setShareStatus('Вэбийн холбоос хуулагдлаа.');
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setShareStatus(publicHome);
    }
  }

  return <footer className="tw-site-footer">
    <section className="tw-footer-care" id="how-it-works">
      <h2>Түрээслэхээс өмнө</h2>
      <p className="tw-how-intro">Хэрэгтэй эд зүйлээ олоод, зарын эзэнд түрээсийн хүсэлт илгээнэ. Эзэн зөвшөөрвөл авах, буцаах нөхцлөө хамт тохирно.</p>
      <div>
        <p><strong>Хүссэнээ ол</strong><br />Хайлтаар эсвэл ангиллаар үзэж, өөрт хэрэгтэй зараа сонгоорой.</p>
        <p><strong>Нөхцлөө тохиролцоорой</strong><br />Үнэ, хугацаа, авах болон буцаах байршлаа эзэнтэй нь ярилцаарай.</p>
        <p><strong>Шалгаж аваарай</strong><br />Эд зүйлийн байдлыг хүлээн авахдаа хамт шалгаж тэмдэглээрэй.</p>
      </div>
    </section>
    <section className="tw-footer-cta">
      <div><h2>Түрээслэхэд бэлэн үү?</h2><p>{page.footerText}</p></div>
      <div className="tw-footer-actions">
        <button type="button" className="tw-button" onClick={onBrowse}>Зар үзэх</button>
        <button type="button" className="tw-footer-secondary" onClick={() =>
          document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Хэрхэн ажилладаг вэ?</button>
      </div>
    </section>
    <div className="tw-footer-share">
      <div className="tw-footer-share-main">
        <strong>Arivly-г найздаа танилцуулаарай</strong>
        <button type="button" className="tw-text-button" onClick={() => void share()}>Хуваалцах</button>
      </div>
      <nav className="tw-footer-support" aria-label="Тусламж, санал хүсэлт">
        <Link href="/help">Тусламж</Link>
        <Link href="/feedback">Санал хүсэлт</Link>
      </nav>
      {shareStatus && <span role="status">{shareStatus}</span>}
    </div>
    <div className="tw-footer-trust">
      <div className="tw-footer-payments" aria-label="Төлбөр ба холболт">
        <span title="Вэб болон Android дээрх QPay">QPay</span>
        <span title="iOS апп доторх худалдан авалт">App Store төлбөр</span>
        <span title="Android апп доторх худалдан авалт">Google Play төлбөр</span>
        <span title={secure ? 'Холболт HTTPS-ээр шифрлэгдсэн' : 'Нийтийн вэб HTTPS ашигладаг'}>
          <LockKeyhole size={14} aria-hidden /> {secure ? 'SSL / HTTPS' : 'HTTPS · Нийтийн сайт'}
        </span>
      </div>
      {rating && <div className="tw-footer-rating">
        <strong><span aria-hidden="true">★</span> {rating.average.toFixed(1)} / 5</strong>
        <small>App Store, Google Play · {rating.count.toLocaleString('en-US')} үнэлгээ</small>
      </div>}
      <div className="tw-footer-stores" aria-label="Апп татах">
        <a href={appStore} target="_blank" rel="noopener noreferrer"><Smartphone size={18} aria-hidden /> App Store</a>
        <a href={playStore} target="_blank" rel="noopener noreferrer"><Smartphone size={18} aria-hidden /> Google Play</a>
      </div>
    </div>
    <div className="tw-footer-bottom">
      <small>© {new Date().getFullYear()} Arivly</small>
      <div className="tw-footer-social" aria-label="Сошиал хуудас">
        {HOME_SOCIAL_KEYS.map(key => {
          const url = safeHomeSocialLink(key, page.socialLinks?.[key] ?? (key === 'facebook' ? facebook : ''));
          const label = HOME_SOCIAL_LABELS[key];
          return url
            ? <a key={key} href={url} aria-label={label} title={label} target="_blank" rel="noopener noreferrer"><SocialIcon platform={key} /></a>
            : <span key={key} title={`${label} · холбоос нэмэгдээгүй`} aria-label={`${label} · холбоос нэмэгдээгүй`}><SocialIcon platform={key} /></span>;
        })}
      </div>
      <nav aria-label="Вэбийн бодлогууд">
        <a href="/cookie-policy.html">Cookie бодлого</a>
        <Link href="/help/privacy">Нууцлалын бодлого</Link>
        <Link href="/help/terms">Үйлчилгээний нөхцөл</Link>
      </nav>
    </div>
  </footer>;
}
