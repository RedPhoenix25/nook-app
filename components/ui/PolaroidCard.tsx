import React from "react";
import { View, Image, Text, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import RenderHtml from "react-native-render-html";

interface MymindCardProps {
  imageUri: string;
  caption?: string;
  aspectRatio?: number;
  authorName?: string;
}

export function PolaroidCard({
  imageUri,
  caption,
  aspectRatio = 1,
  authorName,
}: MymindCardProps) {
  const { width } = useWindowDimensions();
  return (
    <View 
      style={{ aspectRatio }}
      className="rounded-2xl overflow-hidden bg-neutral-200 relative shadow-sm w-full"
    >
      <Image
        source={{ uri: imageUri }}
        className="w-full h-full"
        resizeMode="cover"
      />

      {authorName ? (
        <View className="absolute top-3 left-3 overflow-hidden rounded-full border border-white/30 z-10 shadow-sm">
          <BlurView intensity={70} tint="light" className="px-3 py-1">
            <Text className="text-[11px] font-sans-semibold text-charcoal uppercase tracking-widest">
              {authorName}
            </Text>
          </BlurView>
        </View>
      ) : null}

      {caption ? (
        <View className="absolute bottom-0 left-0 right-0 overflow-hidden">
          <BlurView intensity={80} tint="dark" className="px-5 py-4">
            <View className="items-center justify-center opacity-20">
              <Text 
                className="font-sans text-sm text-white text-center leading-relaxed" 
                numberOfLines={2} 
                ellipsizeMode="tail"
              >
                {caption.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim()}
              </Text>
            </View>
          </BlurView>
        </View>
      ) : null}
    </View>
  );
}
