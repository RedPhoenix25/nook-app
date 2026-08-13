import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Share,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { useSpace } from "../_layout";
import { Export } from "phosphor-react-native";

export default function CreateSpaceScreen() {
  const router = useRouter();
  const { refreshSpace, hasSpace } = useSpace();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const createSpaceCalled = React.useRef(false);

  useEffect(() => {
    if (createSpaceCalled.current) return;
    createSpaceCalled.current = true;
    createSpace();
  }, []);

  async function createSpace() {
    setLoading(true);
    const user = await getCurrentUser();
    if (!user) {
      router.replace("/(auth)/sign-in");
      return;
    }

    // Removed existing member block - allow creating multiple spaces!

    // Call our Postgres RPC to securely create the space and join it in one transaction
    const { data: space, error } = await supabase.rpc("create_space", {
      space_name: "Our Space",
    });

    if (error || !space) {
      Alert.alert("Error", "Failed to create your space. Please try again.");
      setLoading(false);
      return;
    }

    // Refresh global space state so AuthGate knows we can access the app
    await refreshSpace();

    setInviteCode(space.invite_code);
    setLoading(false);
  }

  async function handleShare() {
    if (!inviteCode) return;
    await Share.share({
      message: `Join my Nook space 🌿\n\nUse code: ${inviteCode}\n\nDownload Nook and enter this code to join.`,
      title: "Join my Nook",
    });
  }

  async function handleCopy() {
    if (!inviteCode) return;
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(inviteCode);
    } catch (err) {
      // ignore
    }
    setCopying(true);
    setTimeout(() => setCopying(false), 1500);
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      {hasSpace && (
        <TouchableOpacity 
          onPress={() => router.replace("/(app)")}
          className="absolute top-16 left-6 z-50 px-5 min-h-[44px] justify-center bg-terracotta rounded-full"
        >
          <Text className="font-sans-semibold text-white text-sm">Cancel</Text>
        </TouchableOpacity>
      )}
      <View className="flex-1 px-6 pt-16 items-center w-full">
        {/* Top Header Section */}
        <View className="items-center w-full">
          <Image 
            source={require('@/assets/images/splash-icon.png')} 
            style={{ width: 100, height: 100, borderRadius: 28, marginBottom: 24 }}
            resizeMode="cover"
          />
          <Text className="font-serif text-charcoal text-4xl mb-3 text-center">
            Your space is ready ✦
          </Text>
          <Text className="font-sans text-charcoal-muted text-base text-center leading-relaxed px-4">
            Share this invite code with your partner so they can join your shared space.
          </Text>
        </View>

        {/* Center Card Section */}
        <View className="w-full mt-8">
          {loading ? (
            <View className="bg-white rounded-[2rem] border border-neutral-100 w-full p-6 items-center shadow-sm">
              <Text className="font-sans text-charcoal-muted text-sm">
                Creating your space…
              </Text>
            </View>
          ) : (
            <View className="bg-white rounded-3xl border border-neutral-100 w-full p-6 items-center shadow-sm shadow-black/5">
              {/* Invite code display */}
              <Text className="font-sans-semibold text-charcoal-muted text-[10px] uppercase tracking-widest mb-3">
                Invite Code
              </Text>
              <View className="bg-neutral-50 px-6 py-5 rounded-2xl border border-neutral-100 mb-6 w-full items-center justify-center">
                <Text className="font-serif text-terracotta text-3xl tracking-[0.25em] text-center ml-[0.1em]">
                  {inviteCode}
                </Text>
              </View>
              
              {/* Action Row: Copy & Share */}
              <View className="flex-row gap-3 mb-6 w-full justify-center">
                <TouchableOpacity
                  onPress={handleCopy}
                  className="bg-cream rounded-full px-6 h-12 flex-1 justify-center items-center border border-neutral-200"
                >
                  <Text className="font-sans-medium text-charcoal text-sm">
                    {copying ? "Copied ✓" : "Copy code"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleShare}
                  className="bg-cream rounded-full w-12 h-12 items-center justify-center border border-neutral-200"
                >
                  <Export size={18} color="#444444" weight="fill" />
                </TouchableOpacity>
              </View>

              <Button
                label="Continue to my space"
                onPress={() => router.replace("/(app)")}
                className="w-full"
                disabled={!inviteCode}
              />
            </View>
          )}
        </View>

        {/* Bottom Link Section */}
        <TouchableOpacity
          onPress={() => router.push("/(onboarding)/join-space")}
          className="mt-10"
        >
          <Text className="font-sans text-charcoal-muted text-sm text-center">
            Have a code instead?{" "}
            <Text className="text-terracotta font-sans-semibold">Join a space</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
