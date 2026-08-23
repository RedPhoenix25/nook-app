import React, { useState } from "react";
import { View, ScrollView, ActivityIndicator, Text, TouchableOpacity, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/ui/Header";
import { PromptCard } from "@/components/ui/PromptCard";
import { useMemories } from "@/hooks/useMemories";

import { Image as ImageIcon } from "phosphor-react-native";

export default function MemoriesScreen() {
  const { memories, loading } = useMemories();
  const [selectedMemory, setSelectedMemory] = useState<any | null>(null);

  // Show memories where at least one user has answered
  const displayedMemories = memories.filter(
    (m) => m.myResponse || m.partnerResponse
  );
  const completedCount = memories.filter(
    (m) => m.myResponse && m.partnerResponse
  ).length;

  const renderModal = () => {
    if (!selectedMemory) return null;

    const mySlot = {
      displayName: "You",
      responseText: selectedMemory.myResponse?.response_text || null,
      mediaUrl: selectedMemory.myResponse?.media_url || null,
      isBlurred: false,
      hasResponse: !!selectedMemory.myResponse,
      isCurrentUser: true,
    };

    const partnerSlot = {
      displayName: "Partner",
      responseText: selectedMemory.partnerResponse?.response_text || null,
      mediaUrl: selectedMemory.partnerResponse?.media_url || null,
      isBlurred: !selectedMemory.isUnlocked,
      hasResponse: !!selectedMemory.partnerResponse,
      isCurrentUser: false,
    };

    return (
      <Modal
        visible={!!selectedMemory}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedMemory(null)}
      >
        <SafeAreaView className="flex-1 bg-cream">
          <View className="px-6 pt-6 pb-4 flex-row justify-between items-center border-b border-neutral-200/50">
            <Text className="text-xs font-sans-semibold text-terracotta uppercase tracking-widest">
              Memory Archive
            </Text>
            <TouchableOpacity onPress={() => setSelectedMemory(null)} className="p-2 -mr-2">
              <Text className="text-charcoal font-sans-semibold text-base">Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
            <PromptCard
              promptText={selectedMemory.prompt.prompt_text}
              promptDate={selectedMemory.prompt.prompt_date}
              mySlot={mySlot}
              partnerSlot={partnerSlot}
              hasResponded={!!selectedMemory.myResponse}
              onRespond={() => {}}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <Header 
        title="Memories" 
        variant="large"
        icon={<ImageIcon size={28} color="#E06D53" weight="duotone" />}
      />
      
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#E06D53" />
        </View>
      ) : displayedMemories.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="font-sans text-charcoal-muted text-center text-base leading-relaxed">
            No memories yet. Answer Daily Prompts together to build your archive!
          </Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Archived Stat moved below header */}
          <View className="mb-4 flex-row items-center">
            <View className="bg-terracotta/10 px-3 py-1.5 rounded-full border border-terracotta/20">
              <Text className="text-terracotta font-sans-semibold text-xs tracking-wide">
                {completedCount} Completed
              </Text>
            </View>
          </View>
          {displayedMemories.map((memory) => {
            const dateStr = new Date(memory.prompt.prompt_date).toLocaleDateString(undefined, { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            });

            return (
              <TouchableOpacity 
                key={memory.prompt.id} 
                className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-neutral-200/60"
                activeOpacity={0.8}
                onPress={() => setSelectedMemory(memory)}
              >
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="font-sans text-neutral-400 text-xs uppercase tracking-widest">
                    {dateStr}
                  </Text>
                  {memory.isUnlocked ? (
                    <View className="bg-sage/10 px-2 py-0.5 rounded-full">
                      <Text className="text-[10px] font-sans-semibold text-[#4A7A48] uppercase tracking-wider">Unlocked</Text>
                    </View>
                  ) : (
                    <View className="bg-terracotta/10 px-2 py-0.5 rounded-full">
                      <Text className="text-[10px] font-sans-semibold text-terracotta uppercase tracking-wider">In Progress</Text>
                    </View>
                  )}
                </View>
                <Text className="font-serif text-charcoal text-xl leading-snug" numberOfLines={2}>
                  {memory.prompt.prompt_text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {renderModal()}
    </SafeAreaView>
  );
}
