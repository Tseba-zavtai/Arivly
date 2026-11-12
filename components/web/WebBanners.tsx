import React from 'react';
import { Link, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchBanners, type Banner } from '@/lib/banners';
import { safeHomeLink } from '@/lib/homePageContent';

export function useHomeBanners(enabled = true) {
  const { data } = useQuery({
    queryKey: ['web-home-banners'],
    queryFn: () => fetchBanners('home_feed', 3),
    enabled,
    staleTime: 60_000,
  });
  return data ?? [];
}

export function BannerCard({ banner }: { banner: Banner }) {
  const destination = safeHomeLink(banner.click_url);
  const title = banner.title || 'Arivly баннер';
  const image = <img src={banner.media_url} alt={title} loading="lazy" />;
  const media = banner.media_type === 'video'
    ? <video src={banner.media_url} preload="metadata" muted playsInline controls aria-label={title} />
    : image;
  const link = (child: React.ReactNode) => destination.startsWith('/')
    ? <Link href={destination as Href} className="tw-banner-media-link">{child}</Link>
    : <a href={destination} className="tw-banner-media-link" target="_blank" rel="noopener noreferrer">{child}</a>;
  return <article className="tw-campaign-banner">
    {destination && banner.media_type === 'image' ? link(media) : media}
    {(banner.title || banner.subtitle) && <div className="tw-banner-copy">
      {banner.title && <h3>{banner.title}</h3>}
      {banner.subtitle && <p>{banner.subtitle}</p>}
    </div>}
    {destination && banner.media_type === 'video' && link(<span className="tw-banner-video-link">Дэлгэрэнгүй</span>)}
  </article>;
}
