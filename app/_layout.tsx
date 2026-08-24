import "../global.css";
import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { View, ActivityIndicator, Text, ScrollView } from "react-native";
import {
  useFonts,
  DMSerifDisplay_400Regular,
} from "@expo-google-fonts/dm-serif-display";
import {
  Inter_400Regular,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { AppLockProvider, AppLockContext } from "@/hooks/useAppLock";
import { AppLockScreen } from "@/components/ui/AppLockScreen";
import { SyncProvider } from "@/hooks/useSyncEngine";

// Keep splash visible while we load fonts + session
SplashScreen.preventAutoHideAsync();

import * as SecureStore from 'expo-secure-store';

// Global error boundary — catches any JS crash and shows it on screen
// instead of silently closing the app. Remove once stable.
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#FDFBF7', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#E06D53', marginBottom: 12 }}>App Error</Text>
          <ScrollView style={{ maxHeight: 400 }}>
            <Text style={{ fontSize: 13, color: '#2C2C2C', fontFamily: 'monospace' }}>
              {this.state.error?.message}{"\n\n"}{this.state.error?.stack}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

export type SpaceMeta = {
  id: string;
  name: string | null;
  partner?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    expo_push_token?: string | null;
  };
};

export const SpaceContext = React.createContext({
  spaces: [] as SpaceMeta[],
  activeSpaceId: null as string | null,
  currentUserProfile: null as any | null,
  switchSpace: async (spaceId: string) => {},
  refreshSpace: async () => {},
  hasSpace: false as boolean | null,
});

export function useSpace() {
  return React.useContext(SpaceContext);
}

function AuthGate({ session, isLoading, children }: { session: Session | null; isLoading: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [spaces, setSpaces] = useState<SpaceMeta[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any | null>(null);
  const [checkingSpace, setCheckingSpace] = useState(false);
  const [hasSpace, setHasSpace] = useState<boolean | null>(null);

  // Load cached space metadata immediately on mount so the app displays instantly with 0ms delay
  useEffect(() => {
    async function loadCachedSpaces() {
      if (!session) return;
      try {
        const cachedSpacesRaw = await SecureStore.getItemAsync('cached_spaces_meta');
        const cachedUserRaw = await SecureStore.getItemAsync('cached_user_profile');
        const cachedActiveId = await SecureStore.getItemAsync('last_active_space_id');

        if (cachedSpacesRaw) {
          const parsed = JSON.parse(cachedSpacesRaw) as SpaceMeta[];
          if (parsed && parsed.length > 0) {
            setSpaces(parsed);
            setHasSpace(true);
            if (cachedActiveId && parsed.some(s => s.id === cachedActiveId)) {
              setActiveSpaceId(cachedActiveId);
            } else {
              setActiveSpaceId(parsed[0].id);
            }
          }
        }

        if (cachedUserRaw) {
          setCurrentUserProfile(JSON.parse(cachedUserRaw));
        }
      } catch (e) {
        console.log('[AuthGate] Error reading cached space metadata:', e);
      }
    }
    loadCachedSpaces();
  }, [session]);

  const refreshSpace = async () => {
    if (!session) {
      setHasSpace(null);
      setSpaces([]);
      setActiveSpaceId(null);
      setCurrentUserProfile(null);
      return;
    }
    setCheckingSpace(true);
    
    try {
      // Fetch all active space memberships for the user, along with space data and other members
      const { data, error } = await supabase
        .from("space_members")
        .select(`
          space_id,
          spaces:space_id (
            id,
            name,
            space_members (
              user_id,
              profiles (
                id,
                display_name,
                avatar_url,
                expo_push_token
              )
            )
          )
        `)
        .eq("user_id", session.user.id)
        .eq("is_active", true);
        
      if (error) {
        console.warn("[AuthGate] Network/transient error fetching space_members:", error.message);
        // Do NOT wipe out existing spaces if this was just a transient network/connection error!
        setCheckingSpace(false);
        return;
      }

      if (!data || data.length === 0) {
        // User truly has NO active space memberships
        setHasSpace(false);
        setSpaces([]);
        setActiveSpaceId(null);
        await SecureStore.deleteItemAsync('cached_spaces_meta');
        await SecureStore.deleteItemAsync('last_active_space_id');
      } else {
        setHasSpace(true);
        
        let foundCurrentUserProfile: any = null;
        
        const parsedSpaces: SpaceMeta[] = data.map((row: any) => {
          const space = row.spaces;
          // Find the partner (a member who is not the current user)
          const partnerMember = space.space_members?.find((m: any) => m.user_id !== session.user.id);
          const partnerProfile = partnerMember?.profiles;
          
          // Also capture the current user's profile
          if (!foundCurrentUserProfile) {
            const myMember = space.space_members?.find((m: any) => m.user_id === session.user.id);
            if (myMember?.profiles) {
              foundCurrentUserProfile = myMember.profiles;
            }
          }
          
          return {
            id: space.id,
            name: space.name,
            partner: partnerProfile ? {
              id: partnerMember.user_id,
              display_name: partnerProfile.display_name,
              avatar_url: partnerProfile.avatar_url,
              expo_push_token: partnerProfile.expo_push_token,
            } : undefined
          };
        });
        
        setSpaces(parsedSpaces);
        if (foundCurrentUserProfile) {
          setCurrentUserProfile(foundCurrentUserProfile);
          await SecureStore.setItemAsync('cached_user_profile', JSON.stringify(foundCurrentUserProfile));
        }

        await SecureStore.setItemAsync('cached_spaces_meta', JSON.stringify(parsedSpaces));
        
        // Determine active space
        const lastActiveId = await SecureStore.getItemAsync('last_active_space_id');
        if (lastActiveId && parsedSpaces.some(s => s.id === lastActiveId)) {
          setActiveSpaceId(lastActiveId);
        } else {
          // Fallback to the first space
          setActiveSpaceId(parsedSpaces[0].id);
          await SecureStore.setItemAsync('last_active_space_id', parsedSpaces[0].id);
        }
      }
    } catch (e: any) {
      console.warn("[AuthGate] Unexpected error during refreshSpace:", e?.message);
    } finally {
      setCheckingSpace(false);
    }
  };

  const switchSpace = async (spaceId: string) => {
    if (spaces.some(s => s.id === spaceId)) {
      setActiveSpaceId(spaceId);
      await SecureStore.setItemAsync('last_active_space_id', spaceId);
    }
  };

  // Check if user belongs to an active space when session changes
  useEffect(() => {
    refreshSpace();

    if (session) {
      const channel = supabase.channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'space_members'
          },
          (payload) => {
            // Re-fetch space details when a new member joins or leaves
            refreshSpace();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session]);

  // Handle routing once loading is complete
  useEffect(() => {
    if (isLoading || checkingSpace || hasSpace === null && session) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "(onboarding)";

    if (!session && !inAuthGroup) {
      // Not signed in → send to sign-in
      router.replace("/(auth)/sign-in");
    } else if (session) {
      if (hasSpace) {
        // Signed in WITH space → go to app
        // We only auto-redirect if they are on auth screens.
        // We don't redirect out of onboarding so they can read their new invite code.
        if (inAuthGroup) router.replace("/(app)");
      } else {
        // Signed in WITHOUT space → go to onboarding
        if (!inOnboarding) router.replace("/(onboarding)" as any);
      }
    }
  }, [session, isLoading, segments, hasSpace, checkingSpace]);

  return (
    <SpaceContext.Provider value={{ spaces, activeSpaceId, currentUserProfile, switchSpace, refreshSpace, hasSpace }}>
      {children}
    </SpaceContext.Provider>
  );
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [fontsLoaded] = useFonts({
    DMSerifDisplay_400Regular,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  useEffect(() => {
    // Fetch initial session with a timeout fallback
    const timeout = setTimeout(() => {
      setSession(null);
      setIsLoading(false);
    }, 5000);

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      clearTimeout(timeout);
      setSession(s);
      setIsLoading(false);
    }).catch(() => {
      clearTimeout(timeout);
      setSession(null);
      setIsLoading(false);
    });

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  if (!fontsLoaded || isLoading) {
    return (
      <View className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator size="large" color="#E06D53" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor="#FDFBF7" />
        <AppLockProvider>
          <AuthGate session={session} isLoading={isLoading}>
            <AppLockContext.Consumer>
              {({ isLocked, unlock }) => (
                <View className="flex-1">
                  <SyncProvider>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="(auth)" />
                      <Stack.Screen name="(onboarding)" />
                      <Stack.Screen name="(app)" />
                      <Stack.Screen name="+not-found" />
                    </Stack>
                    {isLocked && session && (
                      <AppLockScreen onUnlock={unlock} />
                    )}
                  </SyncProvider>
                </View>
              )}
            </AppLockContext.Consumer>
          </AuthGate>
        </AppLockProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
