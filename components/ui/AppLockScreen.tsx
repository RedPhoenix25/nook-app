import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Button } from './Button';
import { Lock } from 'phosphor-react-native';

interface AppLockScreenProps {
  onUnlock: () => void;
}

export function AppLockScreen({ onUnlock }: AppLockScreenProps) {
  // Automatically try to unlock when the screen mounts
  useEffect(() => {
    // slight delay to let the screen render first
    const timeout = setTimeout(() => {
      onUnlock();
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} className="z-[999] bg-cream/95 items-center justify-center">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(253,251,247,0.97)' }]} />
      
      <View className="items-center z-10 px-6 w-full">
        <View className="mb-12 items-center">
          <Image 
            source={require('@/assets/images/splash-icon.png')} 
            style={{ width: 80, height: 80, borderRadius: 24, marginBottom: 20 }}
            resizeMode="cover"
          />
          <Text className="font-serif text-charcoal text-4xl mb-2">NOOK.</Text>
          <View className="flex-row items-center gap-2 mt-2">
            <Lock size={16} color="#737373" weight="fill" />
            <Text className="font-sans text-charcoal-muted text-sm uppercase tracking-widest">
              App Locked
            </Text>
          </View>
        </View>

        <Button 
          label="Unlock NOOK"
          onPress={onUnlock}
          className="w-full max-w-[280px]"
        />
      </View>
    </View>
  );
}
