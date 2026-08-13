import React, { useState } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretLeft, CaretDown } from "phosphor-react-native";
import { SpaceSwitcherModal } from "./SpaceSwitcherModal";

interface HeaderProps {
  title: string;
  subtitle?: string;
  variant?: "compact" | "large";
  icon?: React.ReactNode;
  showBack?: boolean;
  rightElement?: React.ReactNode;
  showSpaceSwitcher?: boolean;
}

export function Header({ 
  title, 
  subtitle, 
  variant = "compact", 
  icon,
  showBack = false, 
  rightElement,
  showSpaceSwitcher = false
}: HeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [switcherVisible, setSwitcherVisible] = useState(false);

  const isLarge = variant === "large";

  const renderTitleContent = () => (
    <View className="flex-row items-center gap-2">
      {icon}
      <Text className="font-serif text-charcoal text-4xl tracking-tight">{title}</Text>
      {showSpaceSwitcher && (
        <CaretDown size={24} color="#E06D53" weight="bold" style={{ marginTop: 6 }} />
      )}
    </View>
  );

  return (
    <>
      <View
        style={{ paddingTop: Platform.OS === "android" ? insets.top + 8 : 0 }}
        className={`bg-cream px-6 ${isLarge ? "pb-6 pt-4" : "pb-4 flex-row items-center justify-between"}`}
      >
        {isLarge ? (
          // LARGE VARIANT (Top-level pages)
          <View className="flex-row items-start justify-between w-full">
            <View className="flex-1">
              {subtitle && (
                <View className="flex-row mb-3">
                  <View className="bg-terracotta/10 px-3 py-1 rounded-full border border-terracotta/10">
                    <Text className="text-terracotta text-[11px] font-sans-semibold uppercase tracking-widest">
                      {subtitle}
                    </Text>
                  </View>
                </View>
              )}
              {showSpaceSwitcher ? (
                <TouchableOpacity activeOpacity={0.7} onPress={() => setSwitcherVisible(true)}>
                  {renderTitleContent()}
                </TouchableOpacity>
              ) : (
                renderTitleContent()
              )}
            </View>
            {rightElement && (
              <View className="ml-4 justify-center">
                {rightElement}
              </View>
            )}
          </View>
        ) : (
          // COMPACT VARIANT (Modals / Nested pages)
          <>
            <View className="w-10">
              {showBack && router.canGoBack() && (
                <TouchableOpacity
                  onPress={() => router.back()}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                  className="w-11 h-11 items-center justify-center bg-white rounded-full shadow-sm border border-neutral-100/60"
                >
                  <CaretLeft size={18} color="#E06D53" weight="bold" />
                </TouchableOpacity>
              )}
            </View>

            <View className="flex-1 items-center justify-center">
              {icon && <View className="mb-1">{icon}</View>}
              <Text className="font-serif text-charcoal text-lg text-center">
                {title}
              </Text>
              {subtitle && (
                <Text className="text-charcoal-muted text-[10px] font-sans-medium mt-0.5">
                  {subtitle}
                </Text>
              )}
            </View>

            <View className="w-10 items-end">
              {rightElement ?? null}
            </View>
          </>
        )}
      </View>
      
      {showSpaceSwitcher && (
        <SpaceSwitcherModal 
          visible={switcherVisible} 
          onClose={() => setSwitcherVisible(false)} 
        />
      )}
    </>
  );
}
