import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, SafeAreaView, ScrollView } from "react-native";
import { Card } from "./Card";
import { PencilSimple } from "phosphor-react-native";

interface ResponseSlotProps {
  displayName: string;
  responseText: string | null;
  mediaUrl: string | null;
  isBlurred: boolean;
  hasResponse: boolean;
  isCurrentUser: boolean;
}

interface PromptCardProps {
  promptText: string;
  promptDate: string;
  mySlot: ResponseSlotProps;
  partnerSlot: ResponseSlotProps;
  onRespond?: () => void;
  onEdit?: () => void;
  hasResponded: boolean;
}

function ResponseSlot({ slot, onPress }: { slot: ResponseSlotProps; onPress: () => void }) {
  return (
    <TouchableOpacity 
      className="flex-1" 
      activeOpacity={0.7} 
      onPress={onPress}
      disabled={slot.isBlurred || !slot.responseText}
    >
      <Text className="text-xs font-sans-semibold text-charcoal-muted uppercase tracking-widest mb-2" numberOfLines={1}>
        {slot.isCurrentUser ? "You" : slot.displayName}
      </Text>

      {slot.isBlurred ? (
        slot.hasResponse ? (
          /* Partner has answered but current user hasn't yet — show a locked teaser */
          <View className="bg-terracotta/8 rounded-2xl p-4 min-h-[100px] items-center justify-center border border-terracotta/20">
            <View className="w-7 h-7 rounded-full bg-terracotta/20 mb-2 items-center justify-center">
              <Text style={{ fontSize: 14 }}>🔒</Text>
            </View>
            <Text className="text-terracotta text-xs text-center font-sans-medium leading-relaxed">
              Answer to reveal{"\n"}{slot.displayName}'s response
            </Text>
          </View>
        ) : (
          /* Partner hasn't answered yet */
          <View className="bg-neutral-100 rounded-2xl p-4 min-h-[100px] items-center justify-center border border-neutral-200/60">
            <View className="w-5 h-5 rounded-full bg-neutral-300 mb-2" />
            <Text className="text-charcoal-muted text-xs text-center font-sans leading-relaxed">
              Waiting for{"\n"}{slot.displayName}…
            </Text>
          </View>
        )
      ) : slot.responseText ? (
        /* Revealed response */
        <View className="bg-parchment rounded-2xl p-4 min-h-[100px] border border-neutral-200/60">
          <Text className="text-charcoal font-sans text-sm leading-relaxed" numberOfLines={4}>
            {slot.responseText}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export function PromptCard({
  promptText,
  promptDate,
  mySlot,
  partnerSlot,
  onRespond,
  onEdit,
  hasResponded,
}: PromptCardProps) {
  const [selectedSlot, setSelectedSlot] = useState<ResponseSlotProps | null>(null);

  const handleEditPress = () => {
    setSelectedSlot(null);
    onEdit?.();
  };

  return (
    <>
      <Card elevated className="p-5">
        {/* Date chip */}
        <View className="flex-row mb-4">
          <View className="bg-terracotta/10 px-3 py-1 rounded-full border border-terracotta/10">
            <Text className="text-[11px] font-sans-semibold text-terracotta uppercase tracking-widest">
              {new Date(promptDate).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
        </View>

        {/* Prompt headline — Serif */}
        <Text className="font-serif text-charcoal text-2xl leading-snug mb-5">
          {promptText}
        </Text>

        {/* Dual response slots side-by-side */}
        <View className="flex-row gap-3 mb-5">
          <ResponseSlot slot={mySlot} onPress={() => setSelectedSlot(mySlot)} />
          <ResponseSlot slot={partnerSlot} onPress={() => setSelectedSlot(partnerSlot)} />
        </View>

        {/* CTA — only shown if user hasn't responded yet */}
        {!hasResponded && (
          <TouchableOpacity
            onPress={onRespond}
            className="bg-terracotta rounded-full py-4 items-center flex-row justify-center gap-2 min-h-[48px]"
            activeOpacity={0.85}
          >
            <Text className="text-white font-sans-semibold text-sm tracking-wide">
              Write your response
            </Text>
            <PencilSimple size={16} color="white" weight="bold" />
          </TouchableOpacity>
        )}
      </Card>

      {/* Expanded Modal */}
      <Modal
        visible={!!selectedSlot}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedSlot(null)}
      >
        <SafeAreaView className="flex-1 bg-cream">
          <View className="px-6 pt-6 pb-4 flex-row justify-between items-center border-b border-neutral-200/50">
            <Text className="text-xs font-sans-semibold text-terracotta uppercase tracking-widest">
              {selectedSlot?.isCurrentUser ? "Your Response" : `${selectedSlot?.displayName}'s Response`}
            </Text>
            <View className="flex-row items-center gap-2">
              {selectedSlot?.isCurrentUser && (
                <TouchableOpacity onPress={handleEditPress} className="min-h-[44px] min-w-[44px] items-center justify-center px-3 rounded-full">
                  <Text className="text-terracotta font-sans-semibold text-base">Edit</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setSelectedSlot(null)} className="min-h-[44px] min-w-[44px] items-center justify-center px-4 bg-neutral-200 rounded-full">
                <Text className="text-charcoal font-sans-semibold text-base">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 60 }}>
            <Text className="font-serif text-charcoal text-2xl leading-snug mb-8">
              {promptText}
            </Text>
            <Text className="font-sans text-charcoal text-lg leading-relaxed">
              {selectedSlot?.responseText}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
