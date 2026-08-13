import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  useWindowDimensions,
  Image,
  Alert,
} from "react-native";
import RenderHtml from "react-native-render-html";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { PolaroidCard } from "@/components/ui/PolaroidCard";
import { CreateNoteModal } from "@/components/ui/CreateNoteModal";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { useFeed } from "@/hooks/useFeed";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import type { Note } from "@/types/database.types";
import { useFocusEffect } from "expo-router";
import { SpaceSwitcherModal } from "@/components/ui/SpaceSwitcherModal";
import { Plus, PencilSimple, Trash, X, PushPin, CaretDown } from "phosphor-react-native";

export default function FeedScreen() {
  const { loading, partner, notes, error, addNote, updateNote, deleteNote, togglePinNote, spaceId, currentUserProfile, refreshFeed } = useFeed();
  
  useFocusEffect(
    React.useCallback(() => {
      refreshFeed();
    }, [refreshFeed])
  );

  const { width } = useWindowDimensions();
  
  // Register and sync push tokens
  usePushNotifications(currentUserProfile?.id);

  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Custom Delete Confirmation State
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  // Pinterest-style Context Menu State
  const [longPressedNote, setLongPressedNote] = useState<Note | null>(null);

  const [switcherVisible, setSwitcherVisible] = useState(false);

  // Split notes into two columns for masonry layout
  const leftCol = notes.filter((_, i) => i % 2 === 0);
  const rightCol = notes.filter((_, i) => i % 2 !== 0);

  const handleCreateNote = async (
    content: string,
    type: "text" | "photo" | "audio" = "text",
    mediaUrl?: string
  ) => {
    await addNote(content, type, mediaUrl);
    setCreateModalVisible(false);
  };

  const renderNote = (item: Note) => {
    const isMe = item.author_id !== partner?.id;
    const authorName = isMe ? "You" : partner?.display_name || "Partner";

    if (item.note_type === "photo" && item.media_url) {
      const match = item.media_url.match(/\?ar=([\d.]+)/);
      const aspectRatio = match && match[1] ? parseFloat(match[1]) : 1;

      return (
        <TouchableOpacity 
          key={item.id} 
          className="mb-4 w-full relative"
          activeOpacity={0.9}
          onPress={() => setSelectedNote(item)}
          onLongPress={() => setLongPressedNote(item)}
          delayLongPress={350}
        >
          {item.is_pinned && (
            <View className="absolute -top-3 -right-3 z-10 w-11 h-11 bg-white rounded-full items-center justify-center shadow-sm border border-neutral-100">
              <PushPin size={18} color="#E06D53" weight="fill" />
            </View>
          )}
          <PolaroidCard
            imageUri={item.media_url}
            caption={item.content || undefined}
            aspectRatio={aspectRatio}
            authorName={authorName}
          />
        </TouchableOpacity>
      );
    }

    if (item.note_type === "audio" && item.media_url) {
      return (
        <TouchableOpacity 
          key={item.id}
          className="mb-4 w-full relative" 
          activeOpacity={0.8}
          onPress={() => setSelectedNote(item)}
          onLongPress={() => setLongPressedNote(item)}
          delayLongPress={350}
        >
          {item.is_pinned && (
            <View className="absolute -top-3 -right-3 z-10 w-11 h-11 bg-white rounded-full items-center justify-center shadow-sm border border-neutral-100">
              <PushPin size={18} color="#E06D53" weight="fill" />
            </View>
          )}
          <View className="shadow-sm">
            <View className="bg-white rounded-[28px] p-4 border border-neutral-100">
              <View className="flex-row mb-3">
                <View className="bg-terracotta/10 px-3 py-1 rounded-full">
                  <Text className="text-[11px] font-sans-semibold text-terracotta uppercase tracking-widest">
                    {authorName}
                  </Text>
                </View>
              </View>
              <View className="w-full mb-1">
                <AudioPlayer uri={item.media_url} />
              </View>
              {item.content ? (
                <View className="px-2 pt-2 pb-1 opacity-20">
                  <Text 
                    className="font-sans text-sm text-[#444444] text-center leading-relaxed"
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {item.content.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim()}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity 
        key={item.id}
        className="mb-4 w-full relative" 
        activeOpacity={0.8}
        onPress={() => setSelectedNote(item)}
        onLongPress={() => setLongPressedNote(item)}
        delayLongPress={350}
        >
          {item.is_pinned && (
            <View className="absolute -top-3 -right-3 z-10 w-11 h-11 bg-white rounded-full items-center justify-center shadow-sm border border-neutral-100">
              <PushPin size={18} color="#E06D53" weight="fill" />
            </View>
          )}
          <Card className="p-5 bg-white shadow-sm rounded-3xl">
            <View className="flex-row mb-3">
              <View className="bg-terracotta/10 px-3 py-1 rounded-full">
                <Text className="text-[11px] font-sans-semibold text-terracotta uppercase tracking-widest">
                  {authorName}
                </Text>
              </View>
            </View>
          {item.content ? (
            <View className="max-h-[240px] overflow-hidden relative">
              <RenderHtml
                contentWidth={width / 2 - 32} // Half width minus padding
                source={{ html: item.content }}
                baseStyle={{ fontSize: 15, color: '#333333' }}
                tagsStyles={{
                  b: { fontWeight: 'bold' },
                  strong: { fontWeight: 'bold' },
                  i: { fontStyle: 'italic' },
                  em: { fontStyle: 'italic' },
                }}
              />
            </View>
          ) : null}
        </Card>
      </TouchableOpacity>
    );
  };

  const confirmDelete = (noteId: string) => {
    setDeleteConfirmationId(noteId);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator size="large" color="#E06D53" />
      </View>
    );
  }

  // Dynamic greeting based on time of day
  const currentHour = new Date().getHours();
  let greeting = "Good evening";
  if (currentHour < 12) greeting = "Good morning";
  else if (currentHour < 18) greeting = "Good afternoon";

  return (
    <>
      <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>

        <ScrollView 
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Welcome Section */}
          <View className="mb-8 mt-4">
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => setSwitcherVisible(true)}
              className="flex-row items-center mb-2"
            >
              <Text className="font-serif text-charcoal text-4xl tracking-tight">
                {greeting}{currentUserProfile?.display_name ? `, ${currentUserProfile.display_name}` : ''}.
              </Text>
              <View className="ml-2 mt-1.5">
                <CaretDown size={28} color="#E06D53" weight="bold" />
              </View>
            </TouchableOpacity>
            <Text className="font-sans text-charcoal-muted text-base leading-relaxed">
              {partner
                ? `What's on your mind? Share a moment with ${partner.display_name}.`
                : "What's on your mind? Add a note to your space."}
            </Text>
          </View>

          {error ? (
            <Card className="p-6 mt-4 items-center justify-center bg-red-50 border-2 border-red-200">
              <Text className="font-serif text-red-600 text-xl mb-2">Database Error</Text>
              <Text className="font-sans text-red-500 text-center leading-relaxed">
                {error}
              </Text>
              <Text className="font-sans-medium text-red-400 text-xs text-center mt-4 uppercase tracking-widest">
                Did you run the SQL Migration?
              </Text>
            </Card>
          ) : notes.length === 0 ? (
            <View className="flex-1 items-center justify-center mt-20 px-6">
              <View className="w-24 h-24 bg-white rounded-full items-center justify-center mb-8 shadow-sm border border-neutral-100">
                <PushPin size={40} color="#E06D53" weight="duotone" />
              </View>
              <Text className="font-serif text-charcoal text-3xl mb-3 text-center">
                A blank canvas.
              </Text>
              <Text className="font-sans text-charcoal-muted text-center text-base leading-relaxed max-w-[280px]">
                Upload a photo, record an audio message, or write a note. Your shared space starts here.
              </Text>
            </View>
          ) : (
            <View className="flex-row">
              <View className="flex-1 pr-2">
                {leftCol.map(renderNote)}
              </View>
              <View className="flex-1 pl-2">
                {rightCol.map(renderNote)}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity
          onPress={() => setCreateModalVisible(true)}
          className="absolute bottom-8 right-6 w-14 h-14 bg-terracotta rounded-full items-center justify-center shadow-lg"
          activeOpacity={0.9}
        >
          <Plus size={28} color="#FFFFFF" weight="bold" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Pinterest-style Long Press Context Menu */}
      <Modal
        visible={!!longPressedNote}
        transparent
        animationType="fade"
        onRequestClose={() => setLongPressedNote(null)}
      >
        <View className="flex-1">
          <View className="absolute inset-0 bg-black/70">
            <BlurView intensity={60} tint="dark" className="flex-1" />
          </View>
          
          <TouchableOpacity 
            className="flex-1 justify-center items-center px-8" 
            activeOpacity={1} 
            onPress={() => setLongPressedNote(null)}
          >
          
          <TouchableOpacity activeOpacity={1} className="w-full max-w-[280px] items-center">
            {/* The Note Preview */}
            <View className="w-full pointer-events-none mb-8 opacity-90">
              {longPressedNote && renderNote(longPressedNote)}
            </View>

            {/* Action Buttons Row */}
            <View className="flex-row items-center gap-6 justify-center bg-white/10 px-8 py-5 rounded-[40px] border border-white/20">
              
              <TouchableOpacity 
                className="items-center"
                onPress={async () => {
                  if (longPressedNote) {
                    await togglePinNote(longPressedNote.id, longPressedNote.is_pinned);
                    setLongPressedNote(null);
                  }
                }}
              >
                <View className={`w-12 h-12 rounded-full items-center justify-center mb-2 ${longPressedNote?.is_pinned ? "bg-white" : "bg-neutral-800"}`}>
                  <PushPin size={22} color={longPressedNote?.is_pinned ? "#E06D53" : "#FFFFFF"} weight={longPressedNote?.is_pinned ? "fill" : "regular"} />
                </View>
                <Text className="text-white text-[10px] font-sans-medium tracking-wide">
                  {longPressedNote?.is_pinned ? "Unpin" : "Pin"}
                </Text>
              </TouchableOpacity>

              {longPressedNote?.author_id === currentUserProfile?.id && (
                <>
                  <TouchableOpacity 
                    className="items-center"
                    onPress={() => {
                      setEditingNote(longPressedNote);
                      setLongPressedNote(null);
                    }}
                  >
                    <View className="w-12 h-12 rounded-full bg-neutral-800 items-center justify-center mb-2">
                      <PencilSimple size={22} color="#FFFFFF" />
                    </View>
                    <Text className="text-white text-[10px] font-sans-medium tracking-wide">Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    className="items-center"
                    onPress={() => confirmDelete(longPressedNote.id)}
                  >
                    <View className="w-12 h-12 rounded-full bg-neutral-800 items-center justify-center mb-2">
                      <Trash size={22} color="#E06D53" />
                    </View>
                    <Text className="text-white text-[10px] font-sans-medium tracking-wide">Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>

      <SpaceSwitcherModal 
        visible={switcherVisible} 
        onClose={() => setSwitcherVisible(false)} 
      />

      {/* Expanded Note Modal */}
      <Modal
        visible={!!selectedNote}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedNote(null)}
      >
        <SafeAreaView className="flex-1 bg-cream">
          <View className="px-6 pt-6 pb-4 flex-row justify-between items-center border-b border-neutral-200/50">
            <Text className="text-xs font-sans-semibold text-terracotta uppercase tracking-widest">
              {selectedNote?.author_id !== partner?.id ? "Your Note" : `${partner?.display_name}'s Note`}
            </Text>
            <View className="flex-row items-center gap-4">
              {selectedNote?.author_id === currentUserProfile?.id && (
                <>
                  <TouchableOpacity 
                    onPress={() => {
                      setEditingNote(selectedNote);
                      setSelectedNote(null);
                    }}
                    className="p-2 min-h-[44px] min-w-[44px] items-center justify-center"
                  >
                    <PencilSimple size={22} color="#6B6B6B" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    disabled={isDeleting}
                    onPress={() => confirmDelete(selectedNote.id)}
                    className="p-2 min-h-[44px] min-w-[44px] items-center justify-center"
                  >
                    {isDeleting ? <ActivityIndicator size="small" /> : <Trash size={22} color="#E06D53" />}
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={() => setSelectedNote(null)} className="p-2 ml-1 bg-neutral-200 rounded-full min-h-[44px] min-w-[44px] items-center justify-center">
                <X size={22} color="#333" weight="bold" />
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 60 }}>
            {selectedNote?.created_at && (
              <Text className="text-sm font-sans text-neutral-400 mb-4">
                {new Date(selectedNote.created_at).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit"
                })}
              </Text>
            )}
            
            {selectedNote?.note_type === "photo" && selectedNote.media_url && (
              <View 
                style={{ aspectRatio: parseFloat(selectedNote.media_url.match(/\?ar=([\d.]+)/)?.[1] || "1") }}
                className="mb-6 rounded-2xl overflow-hidden bg-neutral-200 w-full"
              >
                <Image
                  source={{ uri: selectedNote.media_url }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              </View>
            )}

            {selectedNote?.note_type === "audio" && selectedNote.media_url && (
              <View className="mb-6 w-full">
                <AudioPlayer uri={selectedNote.media_url} />
              </View>
            )}

            {selectedNote?.content ? (
              <RenderHtml
                contentWidth={width - 48} // Full width minus padding
                source={{ html: selectedNote.content }}
                baseStyle={{ fontSize: 18, color: '#333333', lineHeight: 28 }}
                tagsStyles={{
                  b: { fontWeight: 'bold' },
                  strong: { fontWeight: 'bold' },
                  i: { fontStyle: 'italic' },
                  em: { fontStyle: 'italic' },
                }}
              />
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Create / Edit Note Modal */}
      <CreateNoteModal
        visible={isCreateModalVisible || !!editingNote}
        onClose={() => {
          setCreateModalVisible(false);
          setEditingNote(null);
        }}
        spaceId={spaceId}
        initialContent={editingNote?.content || ""}
        initialMediaUrl={editingNote?.media_url || ""}
        initialMediaType={editingNote?.note_type}
        onSubmit={async (content, type, url) => {
          if (editingNote) {
            return await updateNote(editingNote.id, content, url);
          } else {
            return await addNote(content, type, url);
          }
        }}
      />

      {/* Custom Themed Confirmation Modal */}
      <Modal
        visible={!!deleteConfirmationId}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmationId(null)}
      >
        <View className="flex-1 justify-center items-center px-6 bg-black/40">
          <View className="bg-cream w-full max-w-[320px] rounded-3xl p-6 shadow-lg items-center">
            <View className="w-12 h-12 rounded-full bg-red-100 items-center justify-center mb-4">
              <Trash size={24} color="#EF4444" weight="fill" />
            </View>
            <Text className="font-serif text-charcoal text-xl mb-2">Delete Note</Text>
            <Text className="font-sans text-charcoal-muted text-center leading-relaxed mb-6">
              Are you sure you want to permanently delete this note? This action cannot be undone.
            </Text>
            <View className="flex-row gap-3 w-full mt-2">
              <TouchableOpacity 
                className="flex-1 py-3 rounded-full bg-neutral-200 items-center justify-center min-h-[48px]"
                onPress={() => setDeleteConfirmationId(null)}
                disabled={isDeleting}
              >
                <Text className="font-sans-medium text-charcoal">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="flex-1 py-3 rounded-full bg-red-500 items-center flex-row justify-center min-h-[48px]"
                disabled={isDeleting}
                onPress={async () => {
                  if (deleteConfirmationId) {
                    setIsDeleting(true);
                    await deleteNote(deleteConfirmationId);
                    setIsDeleting(false);
                    setDeleteConfirmationId(null);
                    setLongPressedNote(null);
                    setSelectedNote(null);
                  }
                }}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="font-sans-medium text-white">Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
