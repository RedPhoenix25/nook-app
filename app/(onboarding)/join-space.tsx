import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  TouchableOpacity
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { useSpace } from "../_layout";

export default function JoinSpaceScreen() {
  const router = useRouter();
  const { refreshSpace, hasSpace } = useSpace();
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(TextInput | null)[]>([]);

  function handleChange(text: string, index: number) {
    const cleaned = text.replace(/[^a-zA-Z0-9]/g, "").slice(0, 1).toUpperCase();
    const next = [...code];
    next[index] = cleaned;
    setCode(next);
    if (cleaned && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  async function handleJoin() {
    const trimmed = code.join("");
    if (trimmed.length !== 6) {
      setError("Please enter the full 6-character code.");
      return;
    }
    setError(null);
    setLoading(true);

    const user = await getCurrentUser();
    if (!user) {
      router.replace("/(auth)/sign-in");
      return;
    }

    // Call our Postgres RPC to securely join the space (bypasses RLS read restrictions)
    const { error: joinError } = await supabase.rpc("join_space", {
      join_code: trimmed,
    });

    setLoading(false);

    if (joinError) {
      if (joinError.message.includes("Invalid invite code")) {
        setError("Code not found. Double-check and try again.");
      } else {
        Alert.alert("Error", "Could not join the space. Please try again.");
      }
    } else {
      await refreshSpace();
      router.replace("/(app)");
    }
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
      <Header title="Join a Space" showBack={!hasSpace} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-10 items-center">
          <Image 
            source={require('@/assets/images/splash-icon.png')} 
            style={{ width: 64, height: 64, marginBottom: 24 }}
            className="rounded-[18px] overflow-hidden"
            resizeMode="contain"
          />
          <Text className="font-serif text-charcoal text-3xl mb-2 text-center">
            Enter invite code
          </Text>
          <Text className="font-sans text-charcoal-muted text-sm mb-12 leading-relaxed text-center">
            Enter the 6-character code shared by your{"\n"}partner to access your quiet corner.
          </Text>

          <View className="flex-row gap-2 mb-8 w-full justify-between">
            {code.map((char, i) => (
              <TextInput
                key={i}
                ref={(ref) => { inputs.current[i] = ref; }}
                value={char}
                onChangeText={(t) => handleChange(t, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                maxLength={1}
                autoCapitalize="characters"
                autoCorrect={false}
                style={{ includeFontPadding: false, paddingTop: 0, paddingBottom: 0 }}
                className={[
                  "flex-1 h-14 text-center font-serif text-3xl rounded-xl border shadow-sm",
                  "bg-white text-charcoal",
                  char ? "border-terracotta shadow-sm" : "border-neutral-100 shadow-black/5",
                ].join(" ")}
              />
            ))}
          </View>
          
          {error && (
            <Text className="text-red-500 font-sans text-xs mt-3 mb-6 text-center">{error}</Text>
          )}

          <Button
            label="Join space"
            loading={loading}
            onPress={handleJoin}
            disabled={code.join("").length !== 6}
            className="w-full"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
