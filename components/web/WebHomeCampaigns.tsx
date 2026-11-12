import React, { useEffect, useState } from 'react';
import { Link, type Href } from 'expo-router';
import { fetchActiveSeasonalCollections, type SeasonalCollection } from '@/lib/seasonalCollections';
import { safeHomeImage } from '@/lib/homePageContent';
import WebHomeRail from './WebHomeRail';
import WebHomeBenefits from './WebHomeBenefits';
import WebHomeMilestones from './WebHomeMilestones';
import { BannerCard, useHomeBanners } from './WebBanners';

export function WebSeasonalCollections({ preview = false }: { preview?: boolean }) {
  const [collections, setCollections] = useState<SeasonalCollection[]>([]);

  useEffect(() => {
    let active = true;
    void fetchActiveSeasonalCollections()
      .then(items => {
        if (!active) return;
        if (preview || items.length < 2) {
          setCollections(items);
          return;
        }
        const key = 'tureesly-web-first-seasonal';
        let first = 0;
        try {
          const previous = sessionStorage.getItem(key);
          first = (items.findIndex(item => item.id === previous) + 1) % items.length;
          sessionStorage.setItem(key, items[first].id);
        } catch { first = Math.floor(Math.random() * items.length); }
        setCollections([...items.slice(first), ...items.slice(0, first)]);
      })
      .catch(error => console.warn('Unable to load seasonal collections', error));
    return () => { active = false; };
  }, [preview]);

  return collections.length > 0 ? (
    <WebHomeRail title="Улирлын цуглуулга" wide hideTitle>
      {collections.map(collection => {
        const image = safeHomeImage(collection.coverImageUrl);
        return <Link
          key={collection.id}
          href={`/seasonal-collection?id=${encodeURIComponent(collection.id)}` as Href}
          className="tw-seasonal-card"
        >
          {image && <img src={image} alt="" loading="lazy" />}
          <div className="tw-seasonal-copy">
            <h3>{collection.title}</h3>
            {collection.subtitle && <p>{collection.subtitle}</p>}
          </div>
          <span className="tw-seasonal-arrow" aria-hidden="true">→</span>
        </Link>;
      })}
    </WebHomeRail>
  ) : null;
}

export default function WebHomeCampaigns() {
  const banners = useHomeBanners();

  return <>
    <WebHomeMilestones />
    <WebHomeBenefits />
    {banners.length > 0 && <WebHomeRail title="Сурталчилгаа" wide threeUp>
      {banners.map(banner => <BannerCard key={banner.id} banner={banner} />)}
    </WebHomeRail>}
  </>;
}
