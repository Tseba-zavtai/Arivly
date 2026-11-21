import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, Modal, View, Text, TouchableOpacity } from 'react-native';
import { applicationId, nativeApplicationVersion } from 'expo-application';
import { requireOptionalNativeModule } from 'expo';
import { useAppLock } from '@/contexts/AppLockContext';
import { useAuth } from '@/contexts/AuthContext';

const APP_STORE_ID = 6777877910;
const APP_STORE_URL = `https://apps.apple.com/mn/app/id${APP_STORE_ID}`;
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=mn.tureestei.app';
const CHECK_INTERVAL = 15 * 60 * 1000;

function isNewer(candidate: unknown, current: string): candidate is string {
  const numericVersion = /^\d+(\.\d+){0,3}$/;
  if (typeof candidate !== 'string' || !numericVersion.test(candidate) || !numericVersion.test(current)) return false;
  const next = candidate.split('.').map(Number);
  const installed = current.split('.').map(Number);
  for (let index = 0; index < Math.max(next.length, installed.length); index++) {
    const difference = (next[index] ?? 0) - (installed[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

async function findStoreUpdate(signal: AbortSignal) {
  if (Platform.OS === 'android') {
    const play = requireOptionalNativeModule<{ availableVersionCode(): Promise<number | null> }>('TureeslyPlayUpdate');
    const version = await play?.availableVersionCode();
    return version ? { version: String(version), url: PLAY_STORE_URL } : null;
  }

  if (Platform.OS !== 'ios' || !nativeApplicationVersion || !applicationId) return null;
  const response = await fetch(`https://itunes.apple.com/lookup?id=${APP_STORE_ID}&country=mn`, { signal });
  if (!response.ok) return null;
  const data = await response.json();
  const listing = data.results?.[0];
  if (listing?.bundleId !== applicationId || !isNewer(listing.version, nativeApplicationVersion)) return null;
  if (isNewer(listing.minimumOsVersion, String(Platform.Version))) return null;
  return { version: listing.version, url: APP_STORE_URL };
}

export default function StoreUpdatePrompt() {
  const { isAppLockReady, isLocked } = useAppLock();
  const { isLoading } = useAuth();
  const lastCheck = useRef(0);
  const [requiredUpdate, setRequiredUpdate] = useState<{ version: string; url: string } | null>(null);

  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web' || isLoading || !isAppLockReady || isLocked) return;
    let disposed = false;
    let request: AbortController | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      if (request || AppState.currentState !== 'active' || Date.now() - lastCheck.current < CHECK_INTERVAL) return;
      lastCheck.current = Date.now();
      const controller = new AbortController();
      request = controller;
      timeout = setTimeout(() => controller.abort(), 6000);
      try {
        const update = await findStoreUpdate(controller.signal);
        if (disposed) return;
        if (controller.signal.aborted || AppState.currentState !== 'active') {
          lastCheck.current = 0;
          return;
        }
        if (update) setRequiredUpdate(update);
      } catch {
        // An offline device or unavailable store can continue using the app.
      } finally {
        clearTimeout(timeout);
        request = undefined;
      }
    }

    void check();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void check();
    });
    return () => {
      disposed = true;
      subscription.remove();
      if (request) {
        request.abort();
        lastCheck.current = 0;
      }
      clearTimeout(timeout);
    };
  }, [isLoading, isAppLockReady, isLocked]);

  return <Modal visible={Boolean(requiredUpdate) && !isLoading && isAppLockReady && !isLocked} transparent animationType="fade" onRequestClose={() => {}}>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', padding: 24 }}>
      <View style={{ width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 24, padding: 28, gap: 18 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#251630' }}>Шинэчлэх шаардлагатай</Text>
        <Text style={{ fontSize: 16, lineHeight: 24, color: '#51465a' }}>Arivly-ийн шинэ хувилбар гарсан байна. Бүртгэл, хүсэлт болон мэдэгдлээ хэвийн ашиглахын тулд дэлгүүрээс шинэчлээрэй.</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => { if (requiredUpdate) void Linking.openURL(requiredUpdate.url).catch(() => Alert.alert('Дэлгүүр нээгдсэнгүй', 'Дэлгүүрээс Arivly гэж хайгаад шинэчлээрэй.')); }} style={{ backgroundColor: '#6E0AB0', borderRadius: 12, padding: 16, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Дэлгүүрээс шинэчлэх</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>;
}
