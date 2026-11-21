// app/_layout.tsx
import React, { useEffect } from "react";
import { router, Stack, usePathname } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";
import { JobsContext } from "@/contexts/JobsContext";
import { AuthContext, useAuth } from "@/contexts/AuthContext";
import { ThemeContext, useTheme } from "@/contexts/ThemeContext";
import { AppLockContext } from "@/contexts/AppLockContext";
import AppLockGate from "@/components/AppLockGate";
import AccountSuspendedGate from "@/components/AccountSuspendedGate";
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from "@/lib/supabase";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import AndroidLaunchBrand from "@/components/AndroidLaunchBrand";
import { StorePurchaseProvider } from "@/contexts/StorePurchaseContext";
import StoreUpdatePrompt from "@/components/StoreUpdatePrompt";
import { savePushDevice } from '@/lib/pushDevice';

const queryClient = new QueryClient();

void SystemUI.setBackgroundColorAsync("#FFE3DD").catch(() => {});

if (Platform.OS !== 'web') Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true, 
    shouldShowList: true,   
  }),
});

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return;
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F71',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Push notification-ийн эрх олгогдсонгүй!');
      return;
    }
    
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        token = (await Promise.race([
          Notifications.getExpoPushTokenAsync({ projectId: "40307900-5fec-4877-a667-4813c7e8c7bb" }),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Push registration timeout')), 15000); }),
        ])).data;
      } finally { clearTimeout(timer); }
    } catch (error) {
      console.log("Push token авахад алдаа гарлаа:", error);
    }
  } else {
    console.log('Эмуляторт push token үүсэх боломжгүй');
  }

  return token;
}

function useNotificationObserver() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const openNotificationTarget = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) {
        if (url.startsWith('/rental-requests') || url.startsWith('/notifications')) router.push(url as any);
      }
    };

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse?.notification) {
      openNotificationTarget(lastResponse.notification);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotificationTarget(response.notification);
    });

    return () => subscription.remove();
  }, []);
}
function RootLayoutNav() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user, refetchProfile } = useAuth();
  const { colors, currentTheme } = useTheme();
  useNotificationObserver();

  useEffect(() => {
    if (!isLoading && user?.danVerifiedAt && !user.danOnboardingCompletedAt && pathname !== "/dan-onboarding") {
      router.replace("/dan-onboarding" as any);
    }
  }, [isLoading, user?.danVerifiedAt, user?.danOnboardingCompletedAt, pathname]);

  useEffect(() => {
    if (AppState.currentState === "active") supabase.auth.startAutoRefresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
      if (state === "active" && isAuthenticated) {
        void refetchProfile().catch(() => {});
      }
    });
    return () => { subscription.remove(); supabase.auth.stopAutoRefresh(); };
  }, [isAuthenticated, refetchProfile]);

  useEffect(() => {
    if (Platform.OS === 'web' || isLoading || !isAuthenticated || !user?.id) return;
    const userId = user.id;
    let stopped = false, busy = false;
    async function setupNotifications() {
      if (stopped || busy || AppState.currentState !== 'active') return;
      busy = true;
      try {
        const token = await registerForPushNotificationsAsync();
        if (token && !stopped) await savePushDevice(token, userId);
      } catch { console.warn('Push registration deferred; retrying on next foreground.'); }
      finally { busy = false; }
    }
    void setupNotifications();
    const resume = AppState.addEventListener('change', state => { if (state === 'active') void setupNotifications(); });
    const rotated = Notifications.addPushTokenListener(() => { void setupNotifications(); });
    return () => { stopped = true; resume.remove(); rotated.remove(); };
  }, [isAuthenticated, isLoading, user?.id]);

  return (
    <>
      <StatusBar style={currentTheme === "purple" || currentTheme === "navy" ? "light" : "dark"} backgroundColor={colors.headerBackground} animated />
      <Stack
      screenOptions={{ 
        headerShown: false, 
        animation: "slide_from_right" 
      }}
    >
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="dan-onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="payment" options={{ headerShown: false }} />
      <Stack.Screen name="review" options={{ headerShown: false }} />
      <Stack.Screen name="browse" options={{ headerShown: false }} />
      <Stack.Screen name="my-jobs" options={{ headerShown: false }} />
      <Stack.Screen name="help" options={{ headerShown: false }} />
      <Stack.Screen name="release-notes" options={{ headerShown: false }} />
      <Stack.Screen name="admin-seasonal" options={{ headerShown: false }} />
      <Stack.Screen name="seasonal-collection" options={{ headerShown: false }} />
      <Stack.Screen name="location-picker" options={{ headerShown: false, animation: "slide_from_bottom" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeContext>
          <AuthContext>
            <AppLockContext>
              <JobsContext>
                <StorePurchaseProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <RootLayoutNav />
                  <StoreUpdatePrompt />
                  <AppLockGate />
                  <AccountSuspendedGate />
                  <AndroidLaunchBrand />
                </GestureHandlerRootView>
                </StorePurchaseProvider>
              </JobsContext>
            </AppLockContext>
          </AuthContext>
        </ThemeContext>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
