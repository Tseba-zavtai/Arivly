import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image as NativeImage,
  Platform,
  RefreshControl,

  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Image from "@/components/ListingImage";
import { Image as CoverImage } from "expo-image";
import { MapPin, Sparkles, Tag } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AppHeader from "@/components/AppHeader";
import BannerCarousel, { type Banner } from "@/components/BannerCarousel";
import { fetchBanners } from "@/lib/banners";
import { useJobs } from "@/contexts/JobsContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  fetchActiveSeasonalCollection,
  jobMatchesSeasonalCollection,
  type SeasonalCollection,
} from "@/lib/seasonalCollections";

function AndroidSeasonalCover({ uri }: { uri: string }) {
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [source, setSource] = useState({ width: 0, height: 0 });
  const scale = source.width > 0 && source.height > 0
    ? Math.max(frame.width / source.width, frame.height / source.height)
    : 0;
  const width = scale ? source.width * scale : frame.width;
  const height = scale ? source.height * scale : frame.height;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject} onLayout={({ nativeEvent }) => setFrame(nativeEvent.layout)}>
      {frame.width > 0 && frame.height > 0 && (
        <NativeImage
          source={{ uri }}
          resizeMode="cover"
          onLoad={({ nativeEvent }) => setSource(nativeEvent.source)}
          style={{ position: "absolute", top: 0, left: (frame.width - width) / 2, width, height }}
        />
      )}
    </View>
  );
}

function getImageUrl(job: any): string | null {
  const urls = job?.image_urls ?? job?.imageUrls ?? null;
  if (Array.isArray(urls) && typeof urls[0] === "string" && urls[0].trim()) return urls[0];
  if (typeof job?.image_url === "string" && job.image_url.trim()) return job.image_url;
  return null;
}

function priceUnit(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized.includes("цаг") || normalized === "hour") return "цаг";
  if (normalized.includes("сар") || normalized === "month") return "сар";
  return "өдөр";
}

function formatPrice(job: any): string {
  const price = Number(job?.price ?? 0);
  if (!Number.isFinite(price) || price <= 0) return "Үнэ тохирно";
  return `${price.toLocaleString("en-US")} ₮ / ${priceUnit(job?.price_type ?? job?.priceType)}`;
}

export default function SeasonalCollectionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const { jobs, loadJobs } = useJobs() as any;
  const jobCount = Array.isArray(jobs) ? jobs.length : 0;
  const [collection, setCollection] = useState<SeasonalCollection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const loadBanners = useCallback(async () => {
    setBanners(await fetchBanners("home_feed"));
  }, []);

  useEffect(() => { void loadBanners(); }, [loadBanners]);

  const loadCollection = useCallback(async () => {
    try {
      setIsLoading(true);
      const next = await fetchActiveSeasonalCollection(String(id ?? ""));
      setCollection(next);
    } catch (error) {
      console.log("SEASONAL COLLECTION LOAD ERROR:", error);
      setCollection(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadCollection();
    if (jobCount === 0) void loadJobs().catch(() => {});
  }, [jobCount, loadCollection, loadJobs]);

  const seasonalJobs = useMemo(() => {
    if (!collection) return [];
    return (Array.isArray(jobs) ? jobs : []).filter((job) => jobMatchesSeasonalCollection(job, collection));
  }, [collection, jobs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadCollection(), loadJobs(), loadBanners()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadCollection, loadJobs, loadBanners]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={collection?.title || "Улирлын сонголт"} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : !collection ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}> 
            <Sparkles size={34} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Онцлох хэсэг одоогоор идэвхгүй байна</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Энэ collection-ийн хугацаа дууссан эсвэл түр идэвхгүй болгосон байж болно.</Text>
          </View>
        ) : (
          <>
            <View style={[styles.hero, { backgroundColor: colors.accent }, !!collection.coverImageUrl && styles.heroWithCover]}>
              {collection.coverImageUrl && (Platform.OS === "android" ? (
                <AndroidSeasonalCover key={collection.coverImageUrl} uri={collection.coverImageUrl} />
              ) : (
                <CoverImage
                  source={{ uri: collection.coverImageUrl }}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                  contentPosition="top center"
                />
              ))}
              <Text style={[styles.heroTitle, { color: colors.text }, !!collection.coverImageUrl && styles.coverTitle]}>
                {collection.title}
              </Text>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Тохирох зарууд</Text>
              <Text style={[styles.countText, { color: colors.textSecondary }]}>{seasonalJobs.length}</Text>
            </View>

            {seasonalJobs.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card }]}> 
                <Tag size={30} color={colors.primary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Одоогоор тохирох зар алга</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Шинэ зар тухайн category эсвэл дэд category-д ормогц энд автоматаар харагдана.</Text>
              </View>
            ) : (
              seasonalJobs.map((job: any, index: number) => {
                const imageUrl = getImageUrl(job);
                const categoryText = [job?.category, job?.subcategory].filter(Boolean).join(" · ");
                const locationText = typeof job?.location === "object" ? job.location?.address : job?.location ?? job?.address;

                return (
                  <React.Fragment key={job.id}>
                  <TouchableOpacity
                    key={job.id}
                    style={[styles.jobCard, { backgroundColor: colors.card }]}
                    activeOpacity={0.82}
                    onPress={() => router.push(`/job-detail?id=${encodeURIComponent(String(job.id))}`)}
                  >
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.jobImage} contentFit="cover" transition={180} />
                    ) : (
                      <View style={[styles.jobImageFallback, { backgroundColor: colors.backgroundSecondary }]}>
                        <Tag size={24} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.jobInfo}>
                      {!!categoryText && <Text style={[styles.categoryText, { color: colors.primary }]} numberOfLines={1}>{categoryText}</Text>}
                      <Text style={[styles.jobTitle, { color: colors.text }]} numberOfLines={2}>{job?.title || "Түрээсийн зар"}</Text>
                      {!!locationText && <View style={styles.locationRow}><MapPin size={13} color={colors.textSecondary} /><Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>{locationText}</Text></View>}
                      <Text style={[styles.priceText, { color: colors.text }]}>{formatPrice(job)}</Text>
                    </View>
                  </TouchableOpacity>
                  {banners.length > 0 && ((index + 1) % 12 === 0 || index === seasonalJobs.length - 1) && (
                    <View style={styles.bannerWrap}>
                      <BannerCarousel banners={banners} />
                    </View>
                  )}
                  </React.Fragment>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { zIndex: 1, elevation: 1 },
  header: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  backButton: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  logo: { width: 104, height: 32 },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 36 },
  bannerWrap: { marginBottom: 12 },
  loadingWrap: { minHeight: 260, justifyContent: "center", alignItems: "center" },
  hero: { borderRadius: 18, padding: 18, marginBottom: 24, overflow: "hidden" },
  heroWithCover: { aspectRatio: 16 / 9, justifyContent: "flex-end", backgroundColor: "#251732" },
  heroTitle: { fontSize: 22, fontWeight: "800" },
  coverTitle: { alignSelf: "flex-start", color: "#FFF", backgroundColor: "rgba(28, 15, 40, 0.75)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  countText: { fontSize: 14, fontWeight: "700" },
  jobCard: { minHeight: 120, borderRadius: 16, overflow: "hidden", flexDirection: "row", marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  jobImage: { width: 112, minHeight: 120, backgroundColor: "#E9E9E9" },
  jobImageFallback: { width: 112, minHeight: 120, alignItems: "center", justifyContent: "center" },
  jobInfo: { flex: 1, padding: 13, justifyContent: "center" },
  categoryText: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  jobTitle: { fontSize: 16, fontWeight: "800", lineHeight: 21 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  locationText: { flex: 1, fontSize: 12 },
  priceText: { fontSize: 14, fontWeight: "800", marginTop: 8 },
  emptyCard: { minHeight: 190, borderRadius: 18, padding: 24, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "800", textAlign: "center", marginTop: 12 },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 7 },
});
