import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
const KEY = '@arivly_push_token';

export async function savePushDevice(token: string, expectedUserId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id !== expectedUserId) return;
  const { error } = await supabase.rpc('register_push_device', { p_token: token });
  if (error) throw error;
  await AsyncStorage.setItem(KEY, token);
}
export async function removePushDevice() {
  const token = await AsyncStorage.getItem(KEY);
  if (!token) return;
  const { error } = await supabase.rpc('unregister_push_device', { p_token: token });
  if (error) throw error;
  await AsyncStorage.removeItem(KEY);
}
