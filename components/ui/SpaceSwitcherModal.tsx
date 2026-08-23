import React from "react";
import { View, Text, TouchableOpacity, Modal, SafeAreaView } from "react-native";
import { useSpace } from "@/app/_layout";
import { useRouter } from "expo-router";
import { Plus, Check, CaretDown, Users } from "phosphor-react-native";

interface SpaceSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SpaceSwitcherModal({ visible, onClose }: SpaceSwitcherModalProps) {
  const { spaces, activeSpaceId, switchSpace } = useSpace();
  const router = useRouter();

  const handleSwitch = (spaceId: string) => {
    switchSpace(spaceId);
    onClose();
  };

  const handleAddNew = () => {
    onClose();
    router.push("/(onboarding)" as any);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-charcoal/40 justify-end">
        <TouchableOpacity className="flex-1" onPress={onClose} activeOpacity={1} />
        
        <View className="bg-cream rounded-t-3xl pt-6 pb-10 px-6 max-h-[80%]">
          <View className="w-12 h-1.5 bg-neutral-300 rounded-full self-center mb-6" />
          
          <Text className="font-serif text-charcoal text-2xl mb-6">Your Spaces</Text>
          
          <View className="gap-3">
            {spaces.map((space) => {
              const isActive = space.id === activeSpaceId;
              
              return (
                <TouchableOpacity
                  key={space.id}
                  onPress={() => handleSwitch(space.id)}
                  activeOpacity={0.7}
                  className={`flex-row items-center justify-between p-4 rounded-2xl border ${
                    isActive ? "bg-white border-terracotta/40" : "bg-white border-neutral-200/70"
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-12 h-12 rounded-full bg-parchment items-center justify-center border border-neutral-200/50">
                      {space.partner?.avatar_url ? (
                        // If we had an Image component we'd use it here, fallback to icon for now
                        <Users size={24} color="#6B7280" weight="duotone" />
                      ) : (
                        <Users size={24} color="#6B7280" weight="duotone" />
                      )}
                    </View>
                    <View>
                      <Text className="font-sans-semibold text-charcoal text-base">
                        {space.name || "Our Space"}
                      </Text>
                      <Text className="font-sans text-charcoal-muted text-sm">
                        with {space.partner?.display_name || "Partner"}
                      </Text>
                    </View>
                  </View>
                  
                  {isActive && (
                    <View className="w-8 h-8 rounded-full bg-terracotta/10 items-center justify-center">
                      <Check size={16} color="#E06D53" weight="bold" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            
            <TouchableOpacity
              onPress={handleAddNew}
              activeOpacity={0.7}
              className="flex-row items-center p-4 rounded-2xl border border-dashed border-neutral-300 mt-2"
            >
              <View className="w-12 h-12 rounded-full bg-neutral-100 items-center justify-center border border-neutral-200/50 mr-3">
                <Plus size={24} color="#6B7280" />
              </View>
              <Text className="font-sans-semibold text-charcoal-muted text-base">
                Create or join a new space
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
