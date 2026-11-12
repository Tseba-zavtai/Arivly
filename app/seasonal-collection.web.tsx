import React, { useEffect, useState } from 'react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useJobs } from '@/contexts/JobsContext';
import { safeHomeImage } from '@/lib/homePageContent';
import { isListingExpired } from '@/lib/listingLifecycle';
import { fetchActiveSeasonalCollection, jobMatchesSeasonalCollection, type SeasonalCollection } from '@/lib/seasonalCollections';
import WebListingCard from '@/components/web/WebListingCard';
import WebListingGrid from '@/components/web/WebListingGrid';
import WebShell from '@/components/web/WebShell';

export default function WebSeasonalCollection() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { jobs, isLoading, savedJobIds, toggleSaveJob } = useJobs();
  const [result, setResult] = useState<{ id: string; collection: SeasonalCollection | null; failed?: boolean }>();
  const collectionId = id ?? '';

  useEffect(() => {
    let active = true;
    void fetchActiveSeasonalCollection(collectionId).then(collection => {
      if (active) setResult({ id: collectionId, collection });
    }).catch(() => {
      if (active) setResult({ id: collectionId, collection: null, failed: true });
    });
    return () => { active = false; };
  }, [collectionId]);

  const ready = result?.id === collectionId;
  const collection = ready ? result?.collection : null;
  const cover = safeHomeImage(collection?.coverImageUrl);
  const listings = collection ? jobs.filter(job =>
    !job.deleted_at && !isListingExpired(job) && jobMatchesSeasonalCollection(job, collection)
  ) : [];

  return <WebShell>
    <div className="tw-collection-page">
      <Link href="/" className="tw-text-button tw-collection-back">← Нүүр</Link>
      {collection ? <>
        <header className={`tw-collection-hero${cover ? ' has-cover' : ''}`}>
          {cover && <img src={cover} alt="" />}
          <div>
            <h1>{collection.title}</h1>
            {collection.subtitle && <p>{collection.subtitle}</p>}
          </div>
        </header>
        <section className="tw-collection-list">
          <div className="tw-section-heading"><h2>Тохирох зарууд</h2>
            {!isLoading && <span>{listings.length} зар</span>}
          </div>
          {isLoading && <p role="status">Заруудыг ачаалж байна…</p>}
          {!isLoading && !listings.length && <p>Одоогоор энэ цуглуулгад зар алга.</p>}
          <WebListingGrid>
            {listings.map(job => <WebListingCard key={job.id} job={job} saved={savedJobIds.includes(job.id)}
              onSave={() => {
                if (isAuthenticated) void toggleSaveJob(job.id);
                else router.push('/auth');
              }} />)}
          </WebListingGrid>
        </section>
      </> : <p role="status">{!ready ? 'Цуглуулгыг ачаалж байна…' : result?.failed
        ? 'Цуглуулгыг ачаалж чадсангүй. Хуудсаа дахин шинэчилнэ үү.'
        : 'Энэ цуглуулга одоогоор идэвхгүй байна.'}</p>}
    </div>
  </WebShell>;
}
