import React, { useState, useEffect } from "react";
import { View, Text, Alert, TouchableOpacity, ActivityIndicator, ScrollView, TextInput, KeyboardAvoidingView, Platform, Modal, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from 'expo-clipboard';
import { router } from "expo-router";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useFeed } from "@/hooks/useFeed";
import { useMemories, MemoryPrompt } from "@/hooks/useMemories";
import type { Space } from "@/types/database.types";
import { useSpace } from "../_layout";
import { AppLockContext } from "@/hooks/useAppLock";

import { User, PencilSimple, SignOut, Door, Heart, Fire, LockKey, Trash } from "phosphor-react-native";

export default function ProfileScreen() {
  const [loadingSignOut, setLoadingSignOut] = useState(false);
  const [space, setSpace] = useState<Space | null>(null);
  
  const { spaceId, currentUserProfile, partner, loading: feedLoading } = useFeed();
  const { memories, loading: memoriesLoading } = useMemories();
  const { refreshSpace } = useSpace();

  // Modals
  const [isEditingSpace, setIsEditingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  const [isLeaving, setIsLeaving] = useState(false);
  const [isLeavingSubmitting, setIsLeavingSubmitting] = useState(false);
  
  const [isDeletingSpace, setIsDeletingSpace] = useState(false);
  const [isDeletingSpaceSubmitting, setIsDeletingSpaceSubmitting] = useState(false);

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isDeletingAccountSubmitting, setIsDeletingAccountSubmitting] = useState(false);

  const { isAppLockEnabled, toggleAppLock } = React.useContext(AppLockContext);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!spaceId) return;
    async function fetchSpace() {
      const { data } = await supabase.from('spaces').select('*').eq('id', spaceId!).single();
      if (data) {
        setSpace(data as Space);
        setNewSpaceName(data.name || "");
      }
    }
    fetchSpace();
  }, [spaceId]);

  useEffect(() => {
    if (currentUserProfile) {
      setNewName(currentUserProfile.display_name || "");
    }
  }, [currentUserProfile]);

  const handleCopyInviteCode = async () => {
    if (space?.invite_code) {
      await Clipboard.setStringAsync(space.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const calculateLongestStreak = (memories: MemoryPrompt[]) => {
    const sorted = [...memories].filter(m => m.isUnlocked).sort((a, b) => new Date(a.prompt.prompt_date).getTime() - new Date(b.prompt.prompt_date).getTime());
    if (sorted.length === 0) return 0;
    
    let currentStreak = 1;
    let maxStreak = 1;

    for (let i = 1; i < sorted.length; i++) {
      const prevDate = new Date(sorted[i - 1].prompt.prompt_date);
      const currDate = new Date(sorted[i].prompt.prompt_date);
      const diffTime = Math.abs(currDate.getTime() - prevDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      if (diffDays === 1) {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else if (diffDays > 1) {
        currentStreak = 1;
      }
    }
    return maxStreak;
  };

  const handleSaveSpaceName = async () => {
    if (!newSpaceName.trim() || !spaceId) return;
    await supabase.from('spaces').update({ name: newSpaceName.trim() }).eq('id', spaceId);
    setSpace(prev => prev ? { ...prev, name: newSpaceName.trim() } : null);
    setIsEditingSpace(false);
  };

  const handleSaveName = async () => {
    if (!newName.trim() || !currentUserProfile?.id) return;
    await supabase.from('profiles').update({ display_name: newName.trim() }).eq('id', currentUserProfile.id);
    setIsEditingName(false);
    // UI updates automatically via useFeed realtime if implemented, or on next load.
  };

  const confirmLeaveSpace = async () => {
    if (!currentUserProfile?.id || !spaceId) return;
    setIsLeavingSubmitting(true);
    await supabase.from('space_members')
      .update({ is_active: false })
      .eq('space_id', spaceId)
      .eq('user_id', currentUserProfile.id);
    
    setIsLeavingSubmitting(false);
    setIsLeaving(false);
    
    // Refresh the global space state. AuthGate will automatically route them to onboarding if they have no spaces left.
    // If they have other spaces, it will automatically switch to one of them.
    await refreshSpace();
    
    // We don't route manually, let AuthGate handle it!
  };

  const confirmDeleteSpace = async () => {
    if (!spaceId) return;
    setIsDeletingSpaceSubmitting(true);
    
    // Delete the space from Supabase. Assuming ON DELETE CASCADE is set up, this will clear related data.
    const { error } = await supabase.from('spaces').delete().eq('id', spaceId);
    
    if (error) {
      Alert.alert("Error", "Could not delete the space. Please try again.");
      setIsDeletingSpaceSubmitting(false);
      return;
    }
    
    setIsDeletingSpaceSubmitting(false);
    setIsDeletingSpace(false);
    
    await refreshSpace();
  };

  const confirmDeleteAccount = async () => {
    setIsDeletingAccountSubmitting(true);
    
    // Call the Postgres RPC to delete the user from auth.users securely
    const { error } = await supabase.rpc('delete_user_account');
    
    if (error) {
      Alert.alert("Error", "Could not delete your account. Please try again.");
      setIsDeletingAccountSubmitting(false);
      return;
    }
    
    setIsDeletingAccountSubmitting(false);
    setIsDeletingAccount(false);
    
    // Sign out to clear local session and trigger AuthGate redirect to sign-in
    handleSignOut();
  };

  const handleSignOut = async () => {
    setLoadingSignOut(true);
    await signOut();
    setLoadingSignOut(false);
  };

  if (feedLoading || !currentUserProfile) {
    return (
      <View className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator size="large" color="#E06D53" />
      </View>
    );
  }

  const daysTogether = space?.created_at ? Math.max(1, Math.ceil((new Date().getTime() - new Date(space.created_at).getTime()) / (1000 * 60 * 60 * 24))) : 1;
  const promptsShared = memories.filter(m => m.isUnlocked).length;
  const longestStreak = calculateLongestStreak(memories);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <Header 
        title="Settings" 
        variant="large" 
        icon={<User size={28} color="#E06D53" weight="duotone" />}
      />
      
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        
        {/* Connection Info */}
        <Card className="p-6 mb-6">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="font-serif text-charcoal text-2xl flex-1 mr-4">
              {space?.name || "Shared Space"}
            </Text>
            <TouchableOpacity onPress={() => setIsEditingSpace(true)} className="w-11 h-11 items-center justify-center bg-neutral-100 rounded-full">
              <PencilSimple size={18} color="#E06D53" weight="duotone" />
            </TouchableOpacity>
          </View>
          <Text className="font-sans text-charcoal-muted text-sm mb-6">
            A quiet place for us.
          </Text>

          <View className="flex-row items-center justify-around border-t border-neutral-100 pt-6">
            {/* You */}
            <View className="items-center flex-1">
              <View className="w-16 h-16 rounded-full bg-terracotta/10 items-center justify-center mb-2 border border-terracotta/20 relative">
                <Text className="text-xl font-serif text-terracotta">
                  {currentUserProfile.display_name?.charAt(0)?.toUpperCase() || "?"}
                </Text>
                <TouchableOpacity 
                  onPress={() => setIsEditingName(true)} 
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                  className="absolute -bottom-1 -right-1 bg-white w-8 h-8 items-center justify-center rounded-full shadow-sm border border-neutral-200"
                >
                  <PencilSimple size={12} color="#E06D53" weight="bold" />
                </TouchableOpacity>
              </View>
              <Text className="font-sans-semibold text-charcoal">
                {currentUserProfile.display_name || "You"}
              </Text>
              <Text className="font-sans text-xs text-charcoal-muted">You</Text>
            </View>

            {/* Partner */}
            <View className="items-center flex-1">
              {partner ? (
                <>
                  <View className="w-16 h-16 rounded-full bg-sage/20 items-center justify-center mb-2 border border-sage/30">
                    <Text className="text-xl font-serif text-sage-dark">
                      {partner.display_name?.charAt(0)?.toUpperCase() || "?"}
                    </Text>
                  </View>
                  <Text className="font-sans-semibold text-charcoal">
                    {partner.display_name || "Partner"}
                  </Text>
                  <Text className="font-sans text-xs text-charcoal-muted">Partner</Text>
                </>
              ) : (
                <>
                  <View className="w-16 h-16 rounded-full bg-neutral-100 items-center justify-center mb-2 border border-neutral-200 border-dashed">
                    <Text className="text-xl font-serif text-neutral-400">?</Text>
                  </View>
                  <Text className="font-sans-semibold text-neutral-400">
                    Waiting...
                  </Text>
                </>
              )}
            </View>
          </View>
        </Card>

        {/* Invite Code Section (if partner is missing) */}
        {!partner && space?.invite_code && (
          <Card className="p-6 mb-6 bg-terracotta/5 border-terracotta/20">
            <Text className="font-sans-semibold text-terracotta text-sm uppercase tracking-widest mb-2">
              Invite your partner
            </Text>
            <Text className="font-sans text-charcoal text-sm mb-4 leading-relaxed">
              Share this invite code with your partner so they can join your space.
            </Text>
            <TouchableOpacity 
              onPress={handleCopyInviteCode}
              activeOpacity={0.7}
              className={`px-4 py-3 rounded-xl border flex-row justify-between items-center ${
                copied ? 'bg-sage/10 border-sage/30' : 'bg-white border-terracotta/30'
              }`}
            >
              <Text className="font-serif text-2xl tracking-widest text-charcoal">
                {space.invite_code}
              </Text>
              <Text className={`font-sans-semibold text-sm ${copied ? 'text-sage-dark' : 'text-terracotta'}`}>
                {copied ? "COPIED!" : "COPY"}
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Stats Dashboard */}
        <Text className="font-sans-semibold text-charcoal-muted text-sm uppercase tracking-widest mb-4 ml-2">
          Your Journey
        </Text>
        <View className="flex-row flex-wrap justify-between mb-8">
          <View className="w-[48%] bg-white rounded-3xl p-5 border border-neutral-100 mb-4 shadow-sm items-center justify-center">
            <View className="bg-terracotta/10 p-3 rounded-full border border-terracotta/10 mb-3">
              <Heart size={24} color="#E06D53" weight="duotone" />
            </View>
            <Text className="font-serif text-charcoal text-3xl mb-1 tracking-tight">{daysTogether}</Text>
            <Text className="font-sans text-xs text-charcoal-muted text-center">Days Together</Text>
          </View>
          <View className="w-[48%] bg-white rounded-3xl p-5 border border-neutral-100 mb-4 shadow-sm items-center justify-center">
            <View className={`p-3 rounded-full border mb-3 ${longestStreak > 0 ? "bg-orange-500/10 border-orange-500/20" : "bg-sage/10 border-sage/10"}`}>
              <Fire size={24} color={longestStreak > 0 ? "#F97316" : "#5B7065"} weight={longestStreak > 0 ? "fill" : "duotone"} />
            </View>
            <Text className="font-serif text-charcoal text-3xl mb-1 tracking-tight">{longestStreak}</Text>
            <Text className="font-sans text-xs text-charcoal-muted text-center">Longest Streak</Text>
          </View>
          <View className="w-full bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex-row items-center justify-between">
            <View>
              <Text className="font-serif text-charcoal text-2xl mb-1">{promptsShared}</Text>
              <Text className="font-sans text-xs text-charcoal-muted">Prompts Shared</Text>
            </View>
            <View className="bg-sage/10 p-3 rounded-full border border-sage/20">
              <User size={24} color="#5B7065" weight="duotone" />
            </View>
          </View>
        </View>

        {/* Security */}
        <Text className="font-sans-semibold text-charcoal-muted text-sm uppercase tracking-widest mb-4 ml-2">
          Security
        </Text>
        <Card className="p-4 mb-8">
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center flex-1 pr-4">
              <LockKey size={22} color="#4A4A4A" weight="regular" />
              <View className="ml-4 flex-1">
                <Text className="font-sans-medium text-charcoal text-base">App Lock</Text>
                <Text className="font-sans text-charcoal-muted text-xs mt-1 leading-relaxed">
                  Require FaceID, TouchID, or PIN to open NOOK
                </Text>
              </View>
            </View>
            <Switch
              value={isAppLockEnabled}
              onValueChange={async (val) => {
                const result = await toggleAppLock(val);
                if (!result.success) {
                  Alert.alert("Error", result.error || "Could not enable App Lock.");
                }
              }}
              trackColor={{ false: "#E5E7EB", true: "#E06D53" }}
              thumbColor={Platform.OS === "android" ? (isAppLockEnabled ? "#FDFBF7" : "#F9FAFB") : undefined}
            />
          </View>
        </Card>
        
        {/* Account Actions */}
        <Text className="font-sans-semibold text-charcoal-muted text-sm uppercase tracking-widest mb-4 ml-2">
          Account Actions
        </Text>
        <Card className="p-2 mb-10">
          <TouchableOpacity 
            onPress={handleSignOut}
            className="flex-row items-center p-4 border-b border-neutral-100 min-h-[56px]"
          >
            <SignOut size={22} color="#4A4A4A" weight="regular" />
            <Text className="font-sans-medium text-charcoal text-base ml-4">Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setIsLeaving(true)}
            className="flex-row items-center p-4 border-b border-neutral-100 min-h-[56px]"
          >
            <Door size={22} color="#EF4444" weight="regular" />
            <Text className="font-sans-medium text-red-500 text-base ml-4">Leave Space</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setIsDeletingSpace(true)}
            className="flex-row items-center p-4 min-h-[56px]"
          >
            <Trash size={22} color="#EF4444" weight="regular" />
            <Text className="font-sans-medium text-red-500 text-base ml-4">Delete Space</Text>
          </TouchableOpacity>
        </Card>

        <Text className="font-sans-semibold text-charcoal-muted text-[11px] uppercase tracking-widest ml-4 mb-3 mt-4">
          Account Management
        </Text>
        <Card className="mb-12 p-1">
          <TouchableOpacity 
            onPress={() => setIsDeletingAccount(true)}
            className="flex-row items-center p-3"
          >
            <View className="w-12 h-12 rounded-2xl bg-red-50 items-center justify-center mr-4 border border-red-100">
               <Trash size={22} color="#DC2626" weight="fill" />
            </View>
            <View className="flex-1 justify-center">
              <Text className="font-sans-semibold text-red-600 text-[15px] mb-0.5">Delete Account</Text>
              <Text className="font-sans text-neutral-400 text-xs leading-tight">Permanently obliterate all your data.</Text>
            </View>
          </TouchableOpacity>
        </Card>

      </ScrollView>

      {/* Edit Space Name Modal */}
      <Modal visible={isEditingSpace} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
          <View className="flex-1 bg-black/40 justify-center items-center px-6">
            <View className="bg-white rounded-3xl w-full p-6 shadow-sm border border-neutral-200/70">
              <Text className="font-serif text-charcoal text-2xl leading-snug mb-2">
                Name your Space
              </Text>
              <Text className="font-sans text-charcoal-muted text-sm mb-6">
                Give your private sanctuary a custom name.
              </Text>
              <TextInput
                value={newSpaceName}
                onChangeText={setNewSpaceName}
                placeholder="Our Nook..."
                placeholderTextColor="#A3A3A3"
                className="font-sans text-charcoal text-lg bg-neutral-50 px-4 py-4 rounded-xl border border-neutral-200 mb-6"
                autoFocus
              />
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 py-4 rounded-full items-center justify-center bg-neutral-100 border border-neutral-200/50"
                  onPress={() => setIsEditingSpace(false)}
                >
                  <Text className="text-charcoal font-sans-semibold text-base">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-4 rounded-full items-center justify-center bg-terracotta"
                  onPress={handleSaveSpaceName}
                >
                  <Text className="text-white font-sans-semibold text-base">Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Display Name Modal */}
      <Modal visible={isEditingName} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
          <View className="flex-1 bg-black/40 justify-center items-center px-6">
            <View className="bg-white rounded-3xl w-full p-6 shadow-sm border border-neutral-200/70">
              <Text className="font-serif text-charcoal text-2xl leading-snug mb-2">
                Edit Display Name
              </Text>
              <Text className="font-sans text-charcoal-muted text-sm mb-6">
                How should your partner see you?
              </Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Your Name..."
                placeholderTextColor="#A3A3A3"
                className="font-sans text-charcoal text-lg bg-neutral-50 px-4 py-4 rounded-xl border border-neutral-200 mb-6"
                autoFocus
              />
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 py-4 rounded-full items-center justify-center bg-neutral-100 border border-neutral-200/50"
                  onPress={() => setIsEditingName(false)}
                >
                  <Text className="text-charcoal font-sans-semibold text-base">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-4 rounded-full items-center justify-center bg-terracotta"
                  onPress={handleSaveName}
                >
                  <Text className="text-white font-sans-semibold text-base">Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Leave Space Confirmation Modal */}
      <Modal visible={isLeaving} transparent animationType="fade">
        <View className="flex-1 bg-black/40 justify-center items-center px-6">
          <View className="bg-white rounded-3xl w-full p-6 shadow-sm border border-neutral-200/70">
            <Text className="font-serif text-charcoal text-2xl leading-snug mb-3">
              Leave this Space?
            </Text>
            <Text className="font-sans text-charcoal-muted text-base leading-relaxed mb-8">
              Leaving will unpair you from your partner. You will no longer be able to see shared prompts or memories. This action is immediate.
            </Text>
            
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-4 rounded-full items-center justify-center bg-neutral-100 border border-neutral-200/50"
                onPress={() => setIsLeaving(false)}
                disabled={isLeavingSubmitting}
              >
                <Text className="text-charcoal font-sans-semibold text-base">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-4 rounded-full items-center justify-center bg-red-500"
                onPress={confirmLeaveSpace}
                disabled={isLeavingSubmitting}
              >
                {isLeavingSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-sans-semibold text-base">Leave Space</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Space Confirmation Modal */}
      <Modal visible={isDeletingSpace} transparent animationType="fade">
        <View className="flex-1 bg-black/40 justify-center items-center px-6">
          <View className="bg-white rounded-3xl w-full p-6 shadow-sm border border-neutral-200/70">
            <Text className="font-serif text-charcoal text-2xl leading-snug mb-3 text-red-600">
              Delete Space?
            </Text>
            <Text className="font-sans text-charcoal-muted text-base leading-relaxed mb-8">
              This will permanently delete the space and all of its memories, notes, and prompts for both you and your partner. This action cannot be undone.
            </Text>
            
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-4 rounded-full items-center justify-center bg-neutral-100 border border-neutral-200/50"
                onPress={() => setIsDeletingSpace(false)}
                disabled={isDeletingSpaceSubmitting}
              >
                <Text className="text-charcoal font-sans-semibold text-base">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-4 rounded-full items-center justify-center bg-red-600"
                onPress={confirmDeleteSpace}
                disabled={isDeletingSpaceSubmitting}
              >
                {isDeletingSpaceSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-sans-semibold text-base">Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal visible={isDeletingAccount} transparent animationType="fade">
        <View className="flex-1 bg-black/40 justify-center items-center px-6">
          <View className="bg-white rounded-3xl w-full p-6 shadow-sm border border-neutral-200/70">
            <Text className="font-serif text-charcoal text-2xl leading-snug mb-3 text-red-600">
              Delete Account?
            </Text>
            <Text className="font-sans text-charcoal-muted text-base leading-relaxed mb-8">
              This will permanently obliterate your account and all associated data, including any spaces you have created and your memories. This action cannot be undone.
            </Text>
            
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-4 rounded-full items-center justify-center bg-neutral-100 border border-neutral-200/50"
                onPress={() => setIsDeletingAccount(false)}
                disabled={isDeletingAccountSubmitting}
              >
                <Text className="text-charcoal font-sans-semibold text-base">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-4 rounded-full items-center justify-center bg-red-600"
                onPress={confirmDeleteAccount}
                disabled={isDeletingAccountSubmitting}
              >
                {isDeletingAccountSubmitting ? (
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
