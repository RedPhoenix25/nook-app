import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, Link } from "expo-router";
import * as SecureStore from 'expo-secure-store';
import { supabase } from "@/lib/supabase";
import { getDb, recordMutation } from "@/lib/database";
import { useDailyPrompt } from "@/hooks/useDailyPrompt";
import { useFeed } from "@/hooks/useFeed";
import { sendPushNotification } from "@/hooks/usePushNotifications";
import { Header } from "@/components/ui/Header";
import { PromptCard } from "@/components/ui/PromptCard";
import { CalendarStar, HandPointing } from "phosphor-react-native";
import { useMemories } from "@/hooks/useMemories";

export default function PromptScreen() {
  const [inputText, setInputText] = useState("");
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  
  // For expanding additional prompts
  const [expandedPromptItem, setExpandedPromptItem] = useState<any | null>(null);
  const [deletePromptId, setDeletePromptId] = useState<string | null>(null);

  const { spaceId, currentUserProfile, partner } = useFeed();
  const { mainPromptItem, additionalPromptItems, loading, refreshPrompt } = useDailyPrompt(spaceId, partner, currentUserProfile);
  const { memories } = useMemories();

  // Completed memories (Streak / Total Shared)
  const completedCount = memories.filter(m => m.isUnlocked).length;

  // Countdown timer logic for main prompt
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (mainPromptItem?.hasResponded) {
      const updateTimer = () => {
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const diff = tomorrow.getTime() - now.getTime();
        
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(interval);
  }, [mainPromptItem?.hasResponded]);

  // Nudge logic
  const [isNudging, setIsNudging] = useState(false);
  const [nudgeCooldown, setNudgeCooldown] = useState(false);

  useEffect(() => {
    async function checkCooldown() {
      const lastNudge = await SecureStore.getItemAsync('last_nudge_time');
      if (lastNudge) {
        const timeSince = Date.now() - parseInt(lastNudge, 10);
        if (timeSince < 2 * 60 * 60 * 1000) { // 2 hours
          setNudgeCooldown(true);
        }
      }
    }
    checkCooldown();
  }, []);

  const handleNudge = async () => {
    if (!partner?.expo_push_token || nudgeCooldown) return;
    setIsNudging(true);
    
    const title = "✦ It's your turn!";
    const body = `${currentUserProfile?.display_name || 'Your partner'} is waiting for your answer.`;
    await sendPushNotification(partner.expo_push_token, title, body);
    
    await SecureStore.setItemAsync('last_nudge_time', Date.now().toString());
    setNudgeCooldown(true);
    setIsNudging(false);
    Alert.alert("Nudge Sent", "We've reminded your partner to answer!");
  };

  useFocusEffect(
    React.useCallback(() => {
      refreshPrompt();
    }, [])
  );

  const handleSubmitResponse = async () => {
    const text = inputText.trim();
    if (!text || !activePromptId || !spaceId || !currentUserProfile) return;

    setIsSubmitting(true);
    
    // Check if we're editing
    let isEditing = false;
    if (mainPromptItem?.prompt.id === activePromptId) {
      isEditing = !!mainPromptItem.mySlot.responseText;
    } else {
      const additional = additionalPromptItems.find(p => p.prompt.id === activePromptId);
      if (additional) isEditing = !!additional.mySlot.responseText;
    }

    let errorToHandle = null;

    if (isEditing) {
      const { error } = await supabase.from("prompt_responses")
        .update({ response_text: text })
        .eq('prompt_id', activePromptId)
        .eq('user_id', currentUserProfile.id);
      errorToHandle = error;
    } else {
      const { error } = await supabase.from("prompt_responses").insert({
        space_id: spaceId,
        user_id: currentUserProfile.id,
        prompt_id: activePromptId,
        response_text: text,
      });
      errorToHandle = error;
    }

    setIsSubmitting(false);

    if (errorToHandle) {
      if (errorToHandle.code === '23505') {
        Alert.alert("Oops!", "You've already answered this prompt.");
        setIsTyping(false);
        refreshPrompt();
      } else {
        Alert.alert("Error", errorToHandle.message);
      }
    } else {
      setInputText("");
      setIsTyping(false);
      setActivePromptId(null);
      refreshPrompt();
      
      if (!isEditing && partner?.expo_push_token) {
        const title = "✦ New Prompt Answer";
        const body = currentUserProfile.display_name
          ? `${currentUserProfile.display_name} answered a prompt.`
          : "Your partner answered a prompt.";
        sendPushNotification(partner.expo_push_token, title, body);
      }
    }
  };

  const handleAddQuestion = async () => {
    const text = newQuestionText.trim();
    if (!text || !spaceId || !currentUserProfile) return;
    setIsSubmitting(true);

    const today = new Date().toISOString().split('T')[0];
    
    try {
      const db = await getDb();
      const newPromptId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const newPrompt = {
        id: newPromptId,
        space_id: spaceId,
        author_id: currentUserProfile.id,
        prompt_text: text,
        prompt_date: today,
        created_at: new Date().toISOString()
      };

      await db.runAsync(
        `INSERT INTO daily_prompts (id, space_id, author_id, prompt_text, prompt_date, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        newPrompt.id, newPrompt.space_id, newPrompt.author_id, newPrompt.prompt_text, newPrompt.prompt_date, newPrompt.created_at
      );
      
      await recordMutation(db, 'INSERT', 'daily_prompts', newPrompt.id, newPrompt);

      setIsSubmitting(false);
      setNewQuestionText("");
      setIsAddingQuestion(false);
      refreshPrompt();
      
      if (partner?.expo_push_token) {
        const title = "✦ New Question Added!";
        const body = `${currentUserProfile.display_name || 'Your partner'} asked a new question for today.`;
        sendPushNotification(partner.expo_push_token, title, body);
      }
    } catch (error: any) {
      setIsSubmitting(false);
      Alert.alert("Error", error.message || "Failed to add question.");
    }
  };


  const openRespondModal = (promptId: string, currentText?: string | null) => {
    setActivePromptId(promptId);
    setInputText(currentText || "");
    setIsTyping(true);
  };

  const handleDeleteQuestion = (promptId: string) => {
    setDeletePromptId(promptId);
  };

  const confirmDeleteQuestion = async () => {
    if (!deletePromptId) return;
    setIsSubmitting(true);
    
    try {
      const db = await getDb();
      await db.runAsync(`DELETE FROM daily_prompts WHERE id = ?`, deletePromptId);
      await recordMutation(db, 'DELETE', 'daily_prompts', deletePromptId, null);
      
      setIsSubmitting(false);
      setDeletePromptId(null);
      setExpandedPromptItem(null);
      refreshPrompt();
    } catch (error) {
      setIsSubmitting(false);
      Alert.alert("Error", "Failed to delete question.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between pr-4">
        <View className="flex-1">
          <Header 
            title="Daily" 
            variant="large" 
            icon={<CalendarStar size={28} color="#E06D53" weight="duotone" />}
          />
        </View>
        <TouchableOpacity 
          onPress={() => setIsAddingQuestion(true)}
          className="bg-white px-4 py-2 rounded-full border border-neutral-200/60 shadow-sm mt-8 min-h-[44px] justify-center"
        >
          <Text className="text-charcoal font-sans-semibold text-sm">Ask Question</Text>
        </TouchableOpacity>
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={20}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Streak Counter moved below header */}
          <View className="mb-6 mt-2 flex-row items-center">
            <View className="bg-terracotta/10 px-3 py-1 rounded-full border border-terracotta/10">
              <Text className="text-terracotta font-sans-semibold text-[11px] tracking-widest uppercase">
                🔥 {completedCount} Prompts Shared
              </Text>
            </View>
          </View>

          {loading || !mainPromptItem ? (
            <View className="items-center justify-center py-20">
              <ActivityIndicator color="#E06D53" size="large" />
            </View>
          ) : (
            <View className="flex-1">
              <View className="mb-8">
                <Text className="font-serif text-charcoal text-4xl mb-2 leading-tight tracking-tight">
                  {mainPromptItem.hasResponded && mainPromptItem.partnerSlot.responseText 
                    ? "You've both shared today." 
                    : mainPromptItem.hasResponded && !mainPromptItem.partnerSlot.responseText 
                      ? "You've shared today." 
                      : "Today's Prompt"}
                </Text>
                <Text className="font-sans text-charcoal-muted text-base leading-relaxed">
                  {mainPromptItem.hasResponded && mainPromptItem.partnerSlot.responseText
                    ? "Come back tomorrow for a new prompt."
                    : mainPromptItem.hasResponded && !mainPromptItem.partnerSlot.responseText
                      ? "Waiting for your partner to answer."
                      : "Share your answer to unlock your partner's."}
                </Text>
              </View>

              <PromptCard
                promptText={mainPromptItem.prompt.prompt_text}
                promptDate={mainPromptItem.prompt.prompt_date}
                mySlot={mainPromptItem.mySlot}
                partnerSlot={mainPromptItem.partnerSlot}
                hasResponded={mainPromptItem.hasResponded}
                onRespond={() => openRespondModal(mainPromptItem.prompt.id)}
                onEdit={() => openRespondModal(mainPromptItem.prompt.id, mainPromptItem.mySlot.responseText)}
              />

              {/* Nudge Button */}
              {mainPromptItem.mySlot.responseText && !mainPromptItem.partnerSlot.responseText && partner && (
                <TouchableOpacity 
                  onPress={handleNudge}
                  disabled={isNudging || nudgeCooldown}
                  className={`mt-6 flex-row items-center justify-center py-4 rounded-full shadow-sm border min-h-[56px] ${
                    nudgeCooldown ? "bg-neutral-100 border-neutral-200" : "bg-white border-terracotta/20"
                  }`}
                >
                  {isNudging ? (
                    <ActivityIndicator color="#E06D53" size="small" />
                  ) : (
                    <>
                      <HandPointing size={20} color={nudgeCooldown ? "#A3A3A3" : "#E06D53"} weight={nudgeCooldown ? "regular" : "duotone"} />
                      <Text className={`ml-2 font-sans-medium ${nudgeCooldown ? "text-neutral-400" : "text-terracotta"}`}>
                        {nudgeCooldown ? "Nudge sent (Cooldown active)" : `Nudge ${partner.display_name}`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Additional Questions */}
              {additionalPromptItems.length > 0 && (
                <View className="mt-10">
                  <Text className="font-sans-semibold text-charcoal-muted text-sm uppercase tracking-widest mb-4">
                    Additional Questions
                  </Text>
                  {additionalPromptItems.map(item => (
                    <TouchableOpacity
                      key={item.prompt.id}
                      activeOpacity={0.8}
                      onPress={() => setExpandedPromptItem(item)}
                      className="bg-white rounded-2xl p-5 mb-3 border border-neutral-200/60 shadow-sm"
                    >
                      <Text className="font-serif text-charcoal text-lg mb-3">
                        {item.prompt.prompt_text}
                      </Text>
                      <View className="flex-row items-center gap-2">
                        <View className={`w-2 h-2 rounded-full ${item.mySlot.responseText ? 'bg-terracotta' : 'bg-neutral-200'}`} />
                        <Text className="text-xs font-sans text-neutral-400 mr-2">You</Text>
                        <View className={`w-2 h-2 rounded-full ${item.partnerSlot.responseText ? 'bg-sage' : 'bg-neutral-200'}`} />
                        <Text className="text-xs font-sans text-neutral-400">{partner?.display_name || 'Partner'}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Countdown for next prompt */}
              {mainPromptItem.hasResponded && (
                <View className="items-center justify-center mt-8 p-4 bg-terracotta/5 rounded-2xl border border-terracotta/10">
                  <Text className="font-sans-semibold text-terracotta text-[10px] uppercase tracking-widest mb-1">
                    Next prompt unlocks in
                  </Text>
                  <Text className="font-serif text-charcoal text-2xl tracking-widest">
                    {timeLeft}
                  </Text>
                </View>
              )}

              {/* Look Back Teaser */}
              <Link href="/(app)/memories" asChild>
                <TouchableOpacity className="mt-12 mb-4 items-center justify-center">
                  <Text className="font-sans-medium text-charcoal-muted underline">
                    Review past answers in Memories
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Type Response Modal (For Main or Additional Prompts) */}
      <Modal
        visible={isTyping}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsTyping(false)}
      >
        <SafeAreaView className="flex-1 bg-cream">
          <View className="px-6 pt-6 pb-4 flex-row justify-between items-center border-b border-neutral-200/50">
            <Text className="text-xs font-sans-semibold text-terracotta uppercase tracking-widest">
              Your Response
            </Text>
            <TouchableOpacity onPress={() => setIsTyping(false)} className="min-h-[44px] justify-center px-2 -mr-2">
              <Text className="text-charcoal font-sans-semibold text-base">Close</Text>
            </TouchableOpacity>
          </View>
          
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
            <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 60 }}>
              <Text className="font-serif text-charcoal text-2xl leading-snug mb-8">
                {activePromptId === mainPromptItem?.prompt.id 
                  ? mainPromptItem?.prompt.prompt_text 
                  : additionalPromptItems.find(p => p.prompt.id === activePromptId)?.prompt.prompt_text}
              </Text>
              
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="What's on your mind?"
                placeholderTextColor="#A3A3A3"
                multiline
                autoFocus
                className="font-sans text-charcoal text-lg leading-relaxed min-h-[150px]"
                style={{ textAlignVertical: "top" }}
              />
              
              <TouchableOpacity
                onPress={handleSubmitResponse}
                disabled={!inputText.trim() || isSubmitting}
                className={`w-full py-4 rounded-full items-center justify-center mt-6 shadow-sm ${
                  inputText.trim() && !isSubmitting ? "bg-terracotta" : "bg-neutral-300"
                }`}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-sans-semibold text-lg">
                    Submit Response
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Add New Question Modal */}
      <Modal
        visible={isAddingQuestion}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsAddingQuestion(false)}
      >
        <SafeAreaView className="flex-1 bg-cream">
          <View className="px-6 pt-6 pb-4 flex-row justify-between items-center border-b border-neutral-200/50">
            <Text className="text-xs font-sans-semibold text-terracotta uppercase tracking-widest">
              Ask a Question
            </Text>
            <TouchableOpacity onPress={() => setIsAddingQuestion(false)} className="min-h-[44px] justify-center px-2 -mr-2">
              <Text className="text-charcoal font-sans-semibold text-base">Close</Text>
            </TouchableOpacity>
          </View>
          
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
            <View className="flex-1 px-6 pt-6">
              <TextInput
                value={newQuestionText}
                onChangeText={setNewQuestionText}
                placeholder="Type your question here..."
                placeholderTextColor="#A3A3A3"
                multiline
                autoFocus
                className="font-serif text-charcoal text-2xl leading-snug min-h-[150px]"
                style={{ textAlignVertical: "top" }}
              />
              
              <TouchableOpacity
                onPress={handleAddQuestion}
                disabled={!newQuestionText.trim() || isSubmitting}
                className={`w-full py-4 rounded-full items-center justify-center mt-6 shadow-sm ${
                  newQuestionText.trim() && !isSubmitting ? "bg-terracotta" : "bg-neutral-300"
                }`}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-sans-semibold text-lg">
                    Ask Question
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Expanded Additional Prompt Modal */}
      <Modal
        visible={!!expandedPromptItem}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setExpandedPromptItem(null)}
      >
        <SafeAreaView className="flex-1 bg-cream">
          <View className="px-6 pt-6 pb-4 flex-row justify-between items-center border-b border-neutral-200/50">
            <Text className="text-xs font-sans-semibold text-terracotta uppercase tracking-widest">
              Extra Question
            </Text>
            <View className="flex-row items-center gap-4">
              {expandedPromptItem?.prompt.author_id === currentUserProfile?.id && (
                <TouchableOpacity onPress={() => handleDeleteQuestion(expandedPromptItem.prompt.id)} className="min-h-[44px] justify-center px-2">
                  <Text className="text-red-500 font-sans-semibold text-base">Delete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setExpandedPromptItem(null)} className="min-h-[44px] justify-center px-2 -mr-2">
                <Text className="text-charcoal font-sans-semibold text-base">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
            {expandedPromptItem && (
              <PromptCard
                promptText={expandedPromptItem.prompt.prompt_text}
                promptDate={expandedPromptItem.prompt.prompt_date}
                mySlot={expandedPromptItem.mySlot}
                partnerSlot={expandedPromptItem.partnerSlot}
                hasResponded={expandedPromptItem.hasResponded}
                onRespond={() => {
                  setExpandedPromptItem(null);
                  openRespondModal(expandedPromptItem.prompt.id);
                }}
                onEdit={() => {
                  setExpandedPromptItem(null);
                  openRespondModal(expandedPromptItem.prompt.id, expandedPromptItem.mySlot.responseText);
                }}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Themed Delete Confirmation Modal */}
      <Modal
        visible={!!deletePromptId}
        transparent
        animationType="fade"
        onRequestClose={() => setDeletePromptId(null)}
      >
        <View className="flex-1 bg-black/40 justify-center items-center px-6">
          <View className="bg-white rounded-3xl w-full p-6 shadow-sm border border-neutral-200/70">
            <Text className="font-serif text-charcoal text-2xl leading-snug mb-3">
              Delete Question?
            </Text>
            <Text className="font-sans text-charcoal-muted text-base leading-relaxed mb-8">
              Are you sure you want to delete this question? Any responses from you or your partner will be permanently lost.
            </Text>
            
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-4 rounded-full items-center justify-center bg-neutral-100 border border-neutral-200/50"
                onPress={() => setDeletePromptId(null)}
                disabled={isSubmitting}
              >
                <Text className="text-charcoal font-sans-semibold text-base">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-4 rounded-full items-center justify-center bg-red-500"
                onPress={confirmDeleteQuestion}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-sans-semibold text-base">Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
