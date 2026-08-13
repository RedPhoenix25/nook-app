import React, { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const APP_LOCK_KEY = 'nook_app_lock_enabled';

export function useAppLock() {
  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const appState = useRef(AppState.currentState);

  // Initialize preference
  useEffect(() => {
    async function checkPref() {
      try {
        const pref = await SecureStore.getItemAsync(APP_LOCK_KEY);
        if (pref === 'true') {
          setIsAppLockEnabled(true);
          setIsLocked(true); // Lock immediately on fresh launch
        }
      } catch (e) {
        console.error("Failed to load app lock preference", e);
      } finally {
        setIsInitialized(true);
      }
    }
    checkPref();
  }, []);

  const backgroundTimestamp = useRef<number | null>(null);

  // Listen to AppState changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // If we are going to background/inactive
      if (
        appState.current.match(/active/) &&
        (nextAppState === 'background' || nextAppState === 'inactive')
      ) {
        if (isAppLockEnabled) {
          backgroundTimestamp.current = Date.now();
        }
      } 
      // If returning to active
      else if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (isAppLockEnabled && backgroundTimestamp.current) {
          const timeInBackground = Date.now() - backgroundTimestamp.current;
          // 15 seconds grace period to allow for image pickers, etc.
          if (timeInBackground > 15000) {
            setIsLocked(true);
          }
        }
        backgroundTimestamp.current = null;
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isAppLockEnabled]);

  const toggleAppLock = async (enable: boolean) => {
    // If enabling, verify they can actually authenticate
    if (enable) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!hasHardware || !isEnrolled) {
        return { success: false, error: 'No biometric or PIN authentication available on this device.' };
      }

      // Verify them once before enabling
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable App Lock',
        fallbackLabel: 'Use PIN',
      });
      if (!auth.success) {
        return { success: false, error: 'Authentication failed.' };
      }
    }
    
    await SecureStore.setItemAsync(APP_LOCK_KEY, enable ? 'true' : 'false');
    setIsAppLockEnabled(enable);
    if (!enable) setIsLocked(false);
    return { success: true };
  };

  const unlock = async () => {
    if (isAuthenticating) return false;
    
    setIsAuthenticating(true);
    try {
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock NOOK',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      
      if (auth.success) {
        setIsLocked(false);
        return true;
      }
    } catch (e) {
      console.error("Auth error", e);
    } finally {
      setIsAuthenticating(false);
    }
    return false;
  };

  return {
    isAppLockEnabled,
    isLocked,
    isInitialized,
    toggleAppLock,
    unlock,
  };
}

export const AppLockContext = React.createContext<ReturnType<typeof useAppLock>>({
  isAppLockEnabled: false,
  isLocked: false,
  isInitialized: false,
  toggleAppLock: async () => ({ success: false }),
  unlock: async () => false,
});

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const appLock = useAppLock();
  return (
    <AppLockContext.Provider value={appLock}>
      {children}
    </AppLockContext.Provider>
  );
}
