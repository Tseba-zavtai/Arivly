import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { completeDanCallback } from '@/lib/danAuth';
import { useAuth } from '@/contexts/AuthContext';

export default function DanCallback() {
  const params = useLocalSearchParams<{ handoff?: string; error?: string; linked?: string }>();
  const router = useRouter();
  const { refetchProfile } = useAuth();
  const [error, setError] = useState('');
  const handoff = typeof params.handoff === 'string' ? params.handoff : '';
  const code = typeof params.error === 'string' ? params.error : '';
  const linked = params.linked === '1' ? '1' : '';

  useEffect(() => {
    let active = true;
    const query = `handoff=${encodeURIComponent(handoff)}${code ? `&error=${encodeURIComponent(code)}` : ''}${linked ? '&linked=1' : ''}`;
    void (async () => {
      try {
        await completeDanCallback(`tureesly://dan-callback?${query}`);
        const profile = await refetchProfile();
        if (!profile) throw new Error('Бүртгэлийн мэдээлэл уншигдсангүй. Дахин оролдоно уу.');
        if (active) router.replace((!profile.phone || !profile.danOnboardingCompletedAt ? '/dan-onboarding' : '/(tabs)') as any);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'DAN нэвтрэлтийг үргэлжлүүлж чадсангүй.');
      }
    })();
    return () => { active = false; };
  }, [handoff, code, linked, refetchProfile, router]);

  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 20, backgroundColor: '#fff' }}>
    {error ? <><Text style={{ fontSize: 16, textAlign: 'center' }}>{error}</Text><Button title="Нэвтрэх хэсэг рүү буцах" onPress={() => router.replace('/auth')} /></> : <><ActivityIndicator size="large" color="#6E0AB0" /><Text>Бүртгэлийг үргэлжлүүлж байна…</Text></>}
  </View>;
}
