import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { verifyOtp } from "@/lib/auth";
import Animated, { FadeInUp } from "react-native-reanimated";

const OTP_LENGTH = 6;

export default function VerifyScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(TextInput | null)[]>([]);

  // Auto-submit when all 6 digits are typed
  useEffect(() => {
    const token = otp.join("");
    if (token.length === OTP_LENGTH && !loading) {
      handleVerify();
    }
  }, [otp]);

  function handleChange(text: string, index: number) {
    const cleaned = text.replace(/\D/g, "").slice(0, 1);
    const next = [...otp];
    next[index] = cleaned;
    setOtp(next);
    if (cleaned && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    const token = otp.join("");
    if (token.length < OTP_LENGTH) {
      setError("Please enter all 6 digits.");
      return;
    }
    setError(null);
    setLoading(true);
    const { session, error: verifyError } = await verifyOtp(email ?? "", token);
    setLoading(false);

    if (verifyError) {
      setError(verifyError);
    }
    // If successful, AuthGate in _layout.tsx will automatically detect the session
    // and route the user to /(app) or /(onboarding) after checking spaces.
  }

  return (
    <View className="flex-1 bg-cream">
      {/* Decorative Background Elements */}
      <View className="absolute top-[-10%] right-[-20%] w-[300px] h-[300px] rounded-full bg-sage/20" />
      <View className="absolute bottom-[20%] left-[-10%] w-[250px] h-[250px] rounded-full bg-terracotta/10" />

      <SafeAreaView className="flex-1">
        
        {/* Simple Cancel Button */}
        <TouchableOpacity 
          onPress={() => router.back()}
          className="absolute top-12 left-6 z-50 px-5 min-h-[44px] justify-center bg-white border border-neutral-100 shadow-sm shadow-black/5 rounded-full"
        >
          <Text className="font-sans-semibold text-charcoal text-sm">Back</Text>
        </TouchableOpacity>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}
            keyboardShouldPersistTaps="handled"
          >
          <Animated.View 
            entering={FadeInUp.duration(800).springify()}
            className="bg-white rounded-[32px] p-8 shadow-xl shadow-black/5 w-full items-center"
          >
            <Text className="font-serif text-charcoal text-3xl mb-3 text-center">
              Verify your email
            </Text>
            <Text className="font-sans text-charcoal-muted text-base mb-8 leading-relaxed text-center">
              We sent a 6-digit code to{"\n"}
              <Text className="text-terracotta font-sans-semibold">{email}</Text>
            </Text>

            {/* OTP Input Row */}
            <View className="flex-row gap-2 mb-8 w-full justify-between">
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => { inputs.current[i] = ref; }}
                  value={digit}
                  onChangeText={(t) => handleChange(t, i)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  style={{ includeFontPadding: false, paddingTop: 0, paddingBottom: 0 }}
                  className={[
                    "flex-1 h-14 text-center font-sans-medium text-2xl rounded-[16px] border shadow-sm",
                    "bg-neutral-50 text-charcoal",
                    digit ? "border-terracotta bg-white shadow-sm" : "border-neutral-100 shadow-black/5",
                  ].join(" ")}
                />
              ))}
            </View>

            {error && (
              <Text className="text-red-500 font-sans text-xs mb-4 text-center">{error}</Text>
            )}

            <Button
              label={loading ? "Verifying..." : "Verify & continue"}
              loading={loading}
              onPress={handleVerify}
              className="w-full"
            />
          </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
