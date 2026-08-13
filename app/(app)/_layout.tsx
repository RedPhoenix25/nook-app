import React from "react";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { House, CalendarStar, Image as ImageIcon, User } from "phosphor-react-native";

export default function AppLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FDFBF7",
          borderTopColor: "rgba(0,0,0,0.08)",
          height: Platform.OS === "ios" ? 85 : 65 + insets.bottom,
          paddingBottom: Platform.OS === "ios" ? 25 : insets.bottom + 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: "#E06D53",
        tabBarInactiveTintColor: "#6B6B6B",
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <House size={22} color={color} weight="bold" />,
        }}
      />
      <Tabs.Screen
        name="prompt"
        options={{
          title: "Daily",
          tabBarIcon: ({ color }) => <CalendarStar size={22} color={color} weight="bold" />,
        }}
      />
      <Tabs.Screen
        name="memories"
        options={{
          title: "Memories",
          tabBarIcon: ({ color }) => <ImageIcon size={22} color={color} weight="bold" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Space",
          tabBarIcon: ({ color }) => <User size={22} color={color} weight="bold" />,
        }}
      />
    </Tabs>
  );
}
