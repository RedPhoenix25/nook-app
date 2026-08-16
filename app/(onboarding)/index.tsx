import React, { useState, useEffect } from "react";
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Image, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import type { Profile } from "@/types/database.types";
import { Button } from "@/components/ui/Button";
import { useSpace } from "../_layout";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown, FadeInUp, SlideInDown } from "react-native-reanimated";

export default function OnboardingHubScreen() {
  const router = useRouter();
  const { refreshSpace, hasSpace } = useSpace();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const user = await getCurrentUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
          setProfile(data as Profile);
          if (data.display_name) {
            setName(data.display_name);
          }
        }
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  const handleSaveName = async () => {
    if (!name.trim() || !profile) return;
    setSaving(true);
    await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', profile.id);
    setProfile({ ...profile, display_name: name.trim() });
    setSaving(false);
    // Also trigger global space refresh to make sure AuthGate has latest context if needed
    await refreshSpace();
  };

  if (loading) {
    return (
      <View className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator size="large" color="#E06D53" />
      </View>
    );
  }

  const needsName = !profile?.display_name;

  return (
    <View className="flex-1 bg-cream">
      {/* Decorative Background Elements */}
      <View className="absolute top-[-10%] right-[-20%] w-[300px] h-[300px] rounded-full bg-sage/20" />
      <View className="absolute bottom-[20%] left-[-10%] w-[250px] h-[250px] rounded-full bg-terracotta/10" />

      <SafeAreaView className="flex-1">
        
        {hasSpace && (
          <TouchableOpacity 
            onPress={() => router.replace("/(app)")}
            className="absolute top-12 left-6 z-50 px-5 min-h-[44px] justify-center bg-terracotta rounded-full"
          >
            <Text className="font-sans-semibold text-white text-sm">Cancel</Text>
          </TouchableOpacity>
        )}

        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"} 
          className="flex-1"
        >
          <ScrollView 
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 pb-10 pt-16 px-6 items-center">
              
              {/* Top Section: Logo and Typography */}
              <Animated.View 
                entering={FadeInDown.duration(1000).springify()}
                className="items-center w-full mb-10"
              >
                <View className="shadow-lg shadow-black/10 rounded-[32px] mb-8 bg-white p-2">
                  <Image 
                    source={require('@/assets/images/splash-icon.png')} 
                    style={{ width: 100, height: 100 }}
                    className="rounded-[24px]"
                    resizeMode="cover"
                  />
                </View>
                <Text className="font-serif text-charcoal text-5xl mb-4 text-center tracking-tight">
                  Welcome to Nook
                </Text>
                <Text className="font-sans text-charcoal-muted text-lg text-center leading-relaxed px-8">
                  Your quiet corner to share memories and prompts with your partner.
                </Text>
              </Animated.View>

              {/* Bottom Section: Glassmorphism Action Area */}
              <Animated.View 
                entering={SlideInDown.duration(800).delay(300).springify()}
                className="w-full"
              >
            <BlurView 
              intensity={80} 
              tint="light" 
              className="w-full rounded-[2.5rem] border border-white/40 overflow-hidden shadow-sm shadow-black/5"
            >
              <View className="p-8 items-center bg-white/40">
                {needsName ? (
                  <Animated.View entering={FadeInUp.duration(500)} className="w-full items-center">
                    <Text className="font-sans text-charcoal text-base mb-6 text-center leading-relaxed font-sans-medium">
                      Before we begin, what should your partner call you?
                    </Text>
                    
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Your Name..."
                      placeholderTextColor="#888888"
                      className="font-sans-medium text-charcoal text-2xl px-4 py-4 mb-8 w-full text-center border-b-2 border-charcoal/10"
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleSaveName}
                    />
                    
                    <Button 
                      label={saving ? "Saving..." : "Continue"} 
                      onPress={handleSaveName}
                      disabled={!name.trim() || saving}
                      className="w-full shadow-md"
                    />
                  </Animated.View>
                ) : (
                  <Animated.View entering={FadeInUp.duration(500)} className="w-full items-center">
                    <Text className="font-sans text-charcoal-muted text-base mb-8 text-center">
                      Signed in as <Text className="font-sans-bold text-charcoal">{profile.display_name}</Text>.
                    </Text>

                    <View className="w-full gap-4">
                      <Button 
                        label="Create a Space" 
                        onPress={() => router.push("/(onboarding)/create-space")}
                        className="w-full shadow-md"
                      />
                      <Button 
                        label="Join a Space" 
                        variant="outline"
                        onPress={() => router.push("/(onboarding)/join-space")}
                        className="w-full bg-white/80"
                      />
                    </View>
                  </Animated.View>
                )}
              </View>
            </BlurView>
          </Animated.View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
