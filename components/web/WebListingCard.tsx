import React, { useState } from 'react';
import { Link } from 'expo-router';
import { isSponsoredPromotionActive } from '@/lib/promotionMetrics';
import type { Job } from '@/mocks/jobs';

const price = (job: Job) => {
  const amount = Number(String(job.price ?? '').replace(/,/g, ''));
  const unit = (job.price_type ?? job.priceType) === 'hourly' ? 'цаг' : (job.price_type ?? job.priceType) === 'monthly' ? 'сар' : 'өдөр';
  return Number.isFinite(amount) && amount > 0 ? <><strong>{amount.toLocaleString('en-US')}₮</strong><span> / {unit}</span></> : <strong>Үнэ тохирно</strong>;
};

export default function ListingCard({ job, saved, onSave }: { job: Job; saved: boolean; onSave: () => void }) {
  const [failed, setFailed] = useState(false);
  const image = job.image_urls?.[0] || job.image_url;
  const title = job.title || job.subcategory || 'Түрээсийн зар';
  const sponsored = isSponsoredPromotionActive(job);
  return <article className="tw-card">
    <Link href={{ pathname: '/job-detail', params: { id: job.id } }} className="tw-card-image" aria-label={`${title} дэлгэрэнгүй`}>
      {image && !failed ? <img src={image} alt={title} loading="lazy" onError={() => setFailed(true)} /> : <div className="tw-image-fallback"><span>t.</span><small>Түрээсийн зар</small></div>}
      {sponsored && <span className="tw-sponsored">Sponsored</span>}
    </Link>
    <button type="button" className={`tw-save ${saved ? 'is-saved' : ''}`} onClick={onSave} aria-label={saved ? 'Хадгалснаас хасах' : 'Зар хадгалах'} aria-pressed={saved}>{saved ? '♥' : '♡'}</button>
    <div className="tw-card-body">
      <span className="tw-card-category">{job.subcategory || job.category || 'Түрээс'}</span>
      <Link href={{ pathname: '/job-detail', params: { id: job.id } }} className="tw-card-title">{title}</Link>
      <p className="tw-card-price">{price(job)}</p>
      <span className="tw-card-location">⌖ {job.location?.address || 'Байршлыг дэлгэрэнгүйгээс'}</span>
    </div>
  </article>;
}
