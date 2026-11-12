import type { Job } from '@/mocks/jobs';
import { isListingExpired } from './listingLifecycle';
import { searchMatch } from './searchUtils';
export type ListingCoordinate = { latitude: number; longitude: number };
export type LocatedListing = { job: Job; coordinate: ListingCoordinate; distanceKm: number | null };

function number(value: unknown) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim()) || !['number','string'].includes(typeof value)) return null;
  const result = Number(value); return Number.isFinite(result) ? result : null;
}
export function listingCoordinate(job: Job): ListingCoordinate | null {
  const candidates = [[job.location?.latitude, job.location?.longitude], [job.latitude, job.longitude]];
  for (const [lat, lng] of candidates) {
    const latitude = number(lat), longitude = number(lng);
    if (latitude !== null && longitude !== null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return { latitude, longitude };
  }
  return null;
}
export function distanceKm(a: ListingCoordinate, b: ListingCoordinate) {
  const rad = (value: number) => value * Math.PI / 180;
  const h = Math.sin(rad(b.latitude-a.latitude)/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function locatedListings(jobs: Job[], options: { query?: string; category?: string; origin?: ListingCoordinate | null; radiusKm?: number | null } = {}): LocatedListing[] {
  const result = jobs.flatMap(job => {
    if (job.isActive === false || job.is_active === false || job.deleted_at || isListingExpired(job)) return [];
    const coordinate = listingCoordinate(job); if (!coordinate) return [];
    if (options.category && job.category !== options.category) return [];
    if (options.query?.trim() && ![job.title,job.subcategory,job.category,job.location?.address].some(value=>searchMatch(String(value ?? ''), options.query!.trim()))) return [];
    const distance = options.origin ? distanceKm(options.origin, coordinate) : null;
    if (options.origin && options.radiusKm != null && distance! > options.radiusKm) return [];
    return [{ job, coordinate, distanceKm: distance }];
  });
  if (options.origin) result.sort((a,b)=>a.distanceKm!-b.distanceKm! || a.job.id.localeCompare(b.job.id));
  return result;
}
