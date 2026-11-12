export type HomeBlockType = 'hero' | 'categories' | 'catalog' | 'promo' | 'text' | 'steps' | 'benefits';
export type HomeBlock = {
  id: string; type: HomeBlockType; enabled: boolean; eyebrow: string; title: string;
  accent: string; body: string; imageUrl: string; buttonLabel: string; buttonHref: string;
};
export type HomeMenuLink = { id: string; label: string; href: string; enabled: boolean };
export type HomeHeader = { logoUrl: string; logoAlt: string; locationTitle: string; links: HomeMenuLink[] };
export const DEFAULT_HOME_HEADER: HomeHeader = {
  logoUrl: '/logo.png', logoAlt: 'Arivly', locationTitle: 'Байршлаар нь олоорой',
  links: [
    { id:'my-jobs',label:'Миний зарууд',href:'/my-jobs',enabled:true },
    { id:'locations',label:'Байршлаар',href:'/#locations',enabled:true },
    { id:'how',label:'Хэрхэн ажилладаг вэ?',href:'/#how-it-works',enabled:true },
  ],
};
export const HOME_SOCIAL_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
};
export type HomeSocial = keyof typeof HOME_SOCIAL_LABELS;
export const HOME_SOCIAL_KEYS = Object.keys(HOME_SOCIAL_LABELS) as HomeSocial[];
type HomeSocialLinks = Partial<Record<HomeSocial, string>>;
export const HOME_STORE_LABELS = { appStore: 'App Store', googlePlay: 'Google Play' };
export const HOME_STORE_KEYS = ['appStore', 'googlePlay'] as const;
type StoreRating = { count: number; average: number };
type HomeStoreRatings = Partial<Record<typeof HOME_STORE_KEYS[number], StoreRating>>;
export type HomePageContent = {
  schemaVersion: 1; announcement: string; footerText: string; header: HomeHeader;
  socialLinks?: HomeSocialLinks; storeRatings?: HomeStoreRatings; sections: HomeBlock[];
};
export const HOME_BLOCK_LABELS: Record<HomeBlockType, string> = {
  hero: 'Том нүүр зураг, хайлт', categories: 'Ангиллууд', catalog: 'Бодит зарын каталог',
  promo: 'Зурагтай уриалга', text: 'Текст, зураг', steps: 'Хэрхэн ажилладаг вэ?', benefits: 'Давуу талын мөр',
};
export function newHomeBlock(type: HomeBlockType, id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`): HomeBlock {
  return { id, type, enabled: true, eyebrow: '', title: HOME_BLOCK_LABELS[type], accent: '', body: '', imageUrl: '', buttonLabel: '', buttonHref: '' };
}
export const DEFAULT_HOME_PAGE: HomePageContent = {
  schemaVersion: 1,
  announcement: 'Хэрэгтэйгээ түрээсэл. Байгаагаа түрээслүүл.',
  footerText: 'Хэрэгтэй үедээ, хэрэгтэй бүхнээ.',
  header: DEFAULT_HOME_HEADER,
  sections: [
    { ...newHomeBlock('hero', 'hero'), eyebrow: 'Өмчлөхөөс илүү боломж', title: 'Хэрэгтэй үедээ.', accent: 'Түрээслээд л болоо.', body: 'Нэг өдрийн ажил, амралтын аялал, шинэ санаа.\nХэрэгтэй бүхнээ эндээс олоорой.', buttonLabel: 'Хайх ↗' },
    { ...newHomeBlock('benefits', 'benefits'), body: '↻ Худалдаж авах албагүй · Хэрэгтэй хугацаандаа ашигла\n⌖ Ойрхоноосоо ол · Монголын түрээсийн зарууд\n↗ Байгаагаа ашигла · Түрээслүүлж орлого ол' },
    { ...newHomeBlock('catalog', 'catalog'), title: 'Бүх зар' },
  ],
};

// Plain text and a limited URL vocabulary only; never render editor input as HTML.
export function safeHomeLink(value: unknown): string {
  if (typeof value !== 'string') return '';
  const link = value.trim();
  if (!link || /[\\\u0000-\u0020\u007f]/.test(link)) return '';
  if (link.startsWith('/') && !link.startsWith('//')) return link;
  try { const url = new URL(link); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function safeHomeImage(value: unknown): string {
  const link = safeHomeLink(value);
  return link.startsWith('https://') || /^\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/i.test(link) ? link : '';
}

export function safeHomeSocialLink(platform: HomeSocial, value: unknown): string {
  const link = safeHomeLink(value);
  if (!link.startsWith('https://')) return '';
  const host = new URL(link).hostname;
  const domain = `${platform}.com`;
  return host === domain || host.endsWith(`.${domain}`) || (platform === 'youtube' && host === 'youtu.be') ? link : '';
}

export function normalizeStoreRating(value: unknown): StoreRating | undefined {
  if (!value || typeof value !== 'object') return;
  const { count, average } = value as Partial<StoreRating>;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) return;
  if (count === 0) return { count: 0, average: 0 };
  if (typeof average !== 'number' || !Number.isFinite(average) || average < 1 || average > 5) return;
  return { count, average };
}

export function getCombinedStoreRating(ratings?: HomeStoreRatings) {
  const apple = normalizeStoreRating(ratings?.appStore);
  const google = normalizeStoreRating(ratings?.googlePlay);
  if (!apple || !google) return null;
  const count = apple.count + google.count;
  if (count < 100) return null;
  return { count, average: (apple.count * apple.average + google.count * google.average) / count };
}

export function normalizeHomePage(value: unknown): HomePageContent {
  if (!value || typeof value !== 'object' || !('sections' in value) || !Array.isArray(value.sections)) return structuredClone(DEFAULT_HOME_PAGE);
  const source = value as Record<string, unknown>;
  const text = (s: unknown, max = 4000) => typeof s === 'string' ? s.slice(0, max) : '';
  const ids = new Set<string>();
  const sections = (source.sections as unknown[]).slice(0, 40).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const block = item as Record<string, unknown>;
    if (typeof block.type !== 'string' || !Object.prototype.hasOwnProperty.call(HOME_BLOCK_LABELS, block.type)) return [];
    const id = text(block.id, 100);
    if (!id || ids.has(id)) return [];
    if (id === 'categories' && block.type === 'categories'
      && block.eyebrow === 'Таны дараагийн төлөвлөгөөнд' && block.title === 'Юу хэрэгтэй байна?') return [];
    if (id === 'promo' && block.type === 'promo' && block.title === 'Танд байгаа зүйл\nхэн нэгэнд хэрэгтэй.') return [];
    if (id === 'steps' && block.type === 'steps' && block.title === 'Гурван алхам. Олон боломж.') return [];
    ids.add(id);
    return [{ id, type: block.type as HomeBlockType, enabled: block.enabled !== false,
      eyebrow: text(block.eyebrow, 200), title: text(block.title, 300), accent: text(block.accent, 300), body: text(block.body),
      imageUrl: safeHomeImage(block.imageUrl), buttonLabel: text(block.buttonLabel, 100), buttonHref: safeHomeLink(block.buttonHref),
    }];
  });
  const rawHeader = source.header && typeof source.header === 'object' ? source.header as Record<string,unknown> : {};
  const menuIds=new Set<string>();
  const links=Array.isArray(rawHeader.links) ? rawHeader.links.slice(0,8).flatMap(item=>{
    if (!item || typeof item!=='object') return [];
    const link=item as Record<string,unknown>,id=text(link.id,100),label=text(link.label,80),href=safeHomeLink(link.href);
    if(!id || !label || !href || menuIds.has(id)) return [];
    menuIds.add(id); return [{id,label,href,enabled:link.enabled!==false}];
  }) : structuredClone(DEFAULT_HOME_HEADER.links);
  const logoAlt = text(rawHeader.logoAlt, 80);
  const header:HomeHeader={logoUrl:safeHomeImage(rawHeader.logoUrl)||DEFAULT_HOME_HEADER.logoUrl,logoAlt:logoAlt && logoAlt !== 'Tureesly' ? logoAlt : DEFAULT_HOME_HEADER.logoAlt,locationTitle:text(rawHeader.locationTitle,200)||DEFAULT_HOME_HEADER.locationTitle,links};
  const socialLinks: HomeSocialLinks = {};
  if (source.socialLinks && typeof source.socialLinks === 'object') {
    const links = source.socialLinks as Record<string, unknown>;
    for (const platform of HOME_SOCIAL_KEYS) {
      if (typeof links[platform] === 'string') socialLinks[platform] = safeHomeSocialLink(platform, links[platform]);
    }
  }
  const storeRatings: HomeStoreRatings = {};
  if (source.storeRatings && typeof source.storeRatings === 'object') {
    const ratings = source.storeRatings as Record<string, unknown>;
    for (const store of HOME_STORE_KEYS) {
      const rating = normalizeStoreRating(ratings[store]);
      if (rating) storeRatings[store] = rating;
    }
  }
  return { schemaVersion: 1, announcement: text(source.announcement, 300), footerText: text(source.footerText, 300), header, socialLinks, storeRatings, sections };
}
