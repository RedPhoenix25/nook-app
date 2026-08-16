import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { signInWithOtp } from "@/lib/auth";
import Animated, { FadeInUp } from "react-native-reanimated";

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSendMagicLink() {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: authError } = await signInWithOtp(email.trim().toLowerCase());
    setLoading(false);

    if (authError) {
      setError(authError);
    } else {
      setSent(true);
    }
  }

  return (
    <View className="flex-1 bg-cream">
      {/* Decorative Background Elements */}
      <View className="absolute top-[-10%] right-[-20%] w-[300px] h-[300px] rounded-full bg-sage/20" />
      <View className="absolute bottom-[20%] left-[-10%] w-[250px] h-[250px] rounded-full bg-terracotta/10" />

      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 px-6 pt-24 pb-10 items-center">
              
              {/* Static Wordmark and Logo */}
              <View className="items-center w-full mb-14">
                <Image 
                  source={require('@/assets/images/splash-icon.png')} 
                  style={{ width: 100, height: 100, borderRadius: 28, marginBottom: 24 }}
                  resizeMode="cover"
                />
                <Text className="font-serif text-charcoal text-5xl mb-2 tracking-tight">NOOK.</Text>
                <Text className="font-sans text-charcoal-muted text-base leading-relaxed text-center">
                  Your quiet corner{"\n"}for two.
                </Text>
              </View>

              {/* Animated Bottom Section */}
              <Animated.View 
                entering={FadeInUp.duration(800).springify()}
                className="w-full"
              >
                {sent ? (
                  /* Confirmation state */
                  <View className="bg-white rounded-[32px] p-8 shadow-xl shadow-black/5 items-center w-full">
                    <Text className="font-serif text-charcoal text-3xl mb-3 text-center">
                      Check your email ✦
                    </Text>
                    <Text className="font-sans text-charcoal-muted text-base leading-relaxed mb-8 text-center">
                      We sent a secure link to{"\n"}
                      <Text className="text-terracotta font-sans-semibold">{email}</Text>
                    </Text>
                    
                    <Button
                      label="Enter code instead"
                      variant="outline"
                      onPress={() => router.push({ pathname: "/(auth)/verify", params: { email } })}
                      className="w-full mb-6"
                    />
                    
                    <TouchableOpacity onPress={() => setSent(false)} className="py-2">
                      <Text className="text-charcoal-muted font-sans-medium text-sm">
                        Change email
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* Email input state */
                  <View className="bg-white rounded-[32px] p-6 shadow-xl shadow-black/5 w-full">
                    <Text className="font-sans-medium text-charcoal text-lg mb-4 ml-2">Sign in to continue</Text>
                    
                    <View className="bg-neutral-50 rounded-2xl border border-neutral-100 px-5 py-4 mb-3">
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="font-sans text-charcoal text-lg"
                        style={{ includeFontPadding: false, paddingTop: 0, paddingBottom: 0 }}
                      />
                    </View>

                    {error && (
                      <Text className="text-red-500 font-sans text-xs mb-3 text-center">
                        {error}
                      </Text>
                    )}

                    <Button
                      label="Continue"
                      loading={loading}
                      onPress={handleSendMagicLink}
                      className="w-full mt-2"
                    />
                  </View>
                )}
              </Animated.View>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
