import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Image,
  ScrollView,
  Animated,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Camera, X, Microphone, Trash, Paperclip, Play, Pause } from "phosphor-react-native";
import { RichEditor, RichToolbar, actions } from "react-native-pell-rich-editor";
import { useAudioRecorder, useAudioPlayer, RecordingPresets, setAudioModeAsync, requestRecordingPermissionsAsync } from "expo-audio";
import { AudioPlayer } from "./AudioPlayer";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

const EDITOR_STYLE = {
  backgroundColor: 'transparent',
  color: '#333333',
  placeholderColor: '#A3A3A3',
  contentCSSText: 'font-family: system-ui, -apple-system, sans-serif; font-size: 18px; line-height: 1.5;',
};

interface CreateNoteModalProps {
  visible: boolean;
  onClose: () => void;
  spaceId: string | null;
  onSubmit: (content: string, type: "text" | "photo" | "audio", mediaUrl?: string) => Promise<{ error: any }>;
  initialContent?: string;
  initialMediaUrl?: string;
  initialMediaType?: "text" | "photo" | "audio";
}

export function CreateNoteModal({
  visible,
  onClose,
  spaceId,
  onSubmit,
  initialContent = "",
  initialMediaUrl = "",
  initialMediaType,
}: CreateNoteModalProps) {
  const [inputText, setInputText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  
  // Audio state
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedAudioUri, setSelectedAudioUri] = useState<string | null>(null);

  const richText = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    if (visible) {
      setEditorKey(prev => prev + 1); // Force remount of the editor
      setInputText(initialContent);
      if (initialMediaType === "audio") {
        setSelectedAudioUri(initialMediaUrl || null);
        setSelectedImageUri(null);
      } else if (initialMediaType === "photo") {
        setSelectedImageUri(initialMediaUrl || null);
        setSelectedAudioUri(null);
        if (initialMediaUrl) {
          const match = initialMediaUrl.match(/\?ar=([\d.]+)/);
          if (match && match[1]) {
            setAspectRatio(parseFloat(match[1]));
          }
        }
      } else {
        setSelectedImageUri(null);
        setSelectedAudioUri(null);
      }
    }
  }, [visible, initialContent, initialMediaUrl, initialMediaType]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission Needed", "We need access to your photos to upload an image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImageUri(asset.uri);
      if (asset.base64) setSelectedImageBase64(asset.base64);
      if (asset.width && asset.height) {
        setAspectRatio(asset.width / asset.height);
      }
      setSelectedAudioUri(null); // Clear audio if image is picked
    }
  };

  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedAudioUri(result.assets[0].uri);
        setSelectedImageUri(null);
        setSelectedImageBase64(null);
      }
    } catch (err) {
      console.log("Error picking audio", err);
    }
  };

  const startRecording = async () => {
    try {
      await requestRecordingPermissionsAsync();
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setRecordingDuration(0);
      setSelectedAudioUri(null);
      setSelectedImageUri(null);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev >= 300) {
            stopRecording(); // max 5 minutes
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (uri) setSelectedAudioUri(uri);
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  const cancelRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
    } catch (err) {
      console.error('Failed to cancel recording', err);
    }
  };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePost = async () => {
    const rawText = inputText.replace(/<[^>]*>?/gm, '').trim();
    if (!rawText && !selectedImageUri && !selectedAudioUri) return;
    
    setIsPosting(true);
    
    try {
      let finalMediaUrl = "";
      
      if (selectedImageUri) {
        if (!selectedImageUri.startsWith('http') && selectedImageBase64) {
          // If it's a local file, just append the aspect ratio and pass it along
          // The sync engine will handle the actual upload later
          finalMediaUrl = `${selectedImageUri}?ar=${aspectRatio.toFixed(3)}`;
        } else {
          finalMediaUrl = selectedImageUri;
        }
        
        const result = await onSubmit(inputText, "photo", finalMediaUrl);
        if (result.error) throw result.error;
      } else if (selectedAudioUri) {
        finalMediaUrl = selectedAudioUri;
        const result = await onSubmit(inputText, "audio", finalMediaUrl);
        if (result.error) throw result.error;
      } else {
        // Text only
        const result = await onSubmit(inputText, "text");
        if (result.error) throw result.error;
      }
      resetAndClose();
    } catch (error: any) {
      import("react-native").then(({ Alert }) => {
        Alert.alert("Error", error.message);
      });
      setIsPosting(false);
    }
  };

  const resetAndClose = () => {
    setInputText("");
    setSelectedImageUri(null);
    setSelectedImageBase64(null);
    setSelectedAudioUri(null);
    setAspectRatio(1);
    setIsPosting(false);
    setIsRecording(false);
    setRecordingDuration(0);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={resetAndClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-cream justify-end"
      >
        <SafeAreaView edges={["top", "bottom"]} className="flex-1">
          {/* Header */}
          <View className="flex-row justify-between items-center px-6 py-4 border-b border-neutral-200/50">
            <TouchableOpacity onPress={resetAndClose} disabled={isPosting || isRecording} className="min-h-[44px] justify-center pr-4">
              <Text className="text-charcoal-muted font-sans text-lg">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePost}
              disabled={isPosting || isRecording || (!inputText.replace(/<[^>]*>?/gm, '').trim() && !selectedImageUri && !selectedAudioUri)}
              className={`min-h-[44px] px-6 items-center justify-center rounded-full ${
                ((inputText.replace(/<[^>]*>?/gm, '').trim() || selectedImageUri || selectedAudioUri) && !isRecording) ? "bg-terracotta" : "bg-neutral-300"
              }`}
            >
              {isPosting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-white font-sans-semibold text-base">Save</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Canvas */}
          <ScrollView 
            className="flex-1 px-6 pt-6"
            contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            {selectedImageUri && (
              <View 
                style={{ aspectRatio: aspectRatio || 1 }} 
                className="relative mb-6 self-start w-full rounded-2xl overflow-hidden bg-neutral-200 shadow-sm"
              >
                <Image
                  source={{ uri: selectedImageUri }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => setSelectedImageUri(null)}
                  className="absolute top-3 right-3 bg-charcoal/60 w-11 h-11 rounded-full items-center justify-center backdrop-blur-sm"
                >
                  <X size={20} color="#FFFFFF" weight="bold" />
                </TouchableOpacity>
              </View>
            )}

            {selectedAudioUri && (
              <View className="mb-6 flex-row items-center gap-2">
                <View className="flex-1">
                  <AudioPlayer uri={selectedAudioUri} />
                </View>
                <TouchableOpacity onPress={() => setSelectedAudioUri(null)} className="w-11 h-11 items-center justify-center bg-neutral-100 rounded-full shadow-sm">
                  <Trash size={20} color="#EF4444" weight="fill" />
                </TouchableOpacity>
              </View>
            )}

            <RichEditor
              key={editorKey}
              ref={richText}
              onChange={setInputText}
              initialContentHTML={initialContent}
              placeholder={(selectedImageUri || selectedAudioUri) ? "Add a caption..." : "What's on your mind?"}
              editorStyle={EDITOR_STYLE}
              style={{ flex: 1, minHeight: 120, marginTop: (selectedImageUri || selectedAudioUri) ? 10 : 0 }}
            />
          </ScrollView>

          {/* Floating Recording Pill */}
          {isRecording && (
            <View className="absolute bottom-6 left-4 right-4 z-50 rounded-[32px] overflow-hidden border border-neutral-200/60 shadow-sm">
              <BlurView intensity={80} tint="light" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <View className="w-full flex-row items-center justify-between px-4 py-3">
                <View className="flex-row items-center">
                  <View className="w-3 h-3 bg-red-500 rounded-full mr-3 animate-pulse shadow-sm" />
                  <Text className="font-sans-medium text-charcoal text-lg w-16">{formatTime(recordingDuration)}</Text>
                </View>
                
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity onPress={cancelRecording} className="w-11 h-11 bg-neutral-200/80 rounded-full items-center justify-center">
                    <Trash size={20} color="#EF4444" weight="fill" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={stopRecording} className="min-h-[44px] px-6 bg-terracotta rounded-full items-center justify-center shadow-sm">
                    <Text className="font-sans-bold text-white text-xs tracking-wider">DONE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Toolbar */}
          {!isRecording && (
            <View className="px-6 pb-6 pt-2 flex-row items-center justify-between">
              <RichToolbar
                editor={richText}
                actions={[
                  actions.setBold,
                  actions.setItalic,
                  actions.setUnderline,
                  actions.insertBulletsList,
                ]}
                iconTint="#8C8C8C"
                selectedIconTint="#E06D53"
                style={{ backgroundColor: 'transparent', flex: 1, alignItems: 'flex-start' }}
              />
              
              {!selectedImageUri && !selectedAudioUri && (
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={handlePickAudio}
                    className="w-11 h-11 rounded-full items-center justify-center bg-white shadow-sm border border-neutral-100"
                  >
                    <Paperclip size={22} color="#6B6B6B" weight="regular" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handlePickImage}
                    className="w-11 h-11 rounded-full items-center justify-center bg-white shadow-sm border border-neutral-100"
                  >
                    <Camera size={22} color="#6B6B6B" weight="regular" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={startRecording}
                    className="w-11 h-11 rounded-full items-center justify-center bg-terracotta shadow-sm"
                  >
                    <Microphone size={22} color="#FFFFFF" weight="fill" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
