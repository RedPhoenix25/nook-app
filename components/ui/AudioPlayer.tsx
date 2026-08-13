import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, Animated } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Play, Pause } from 'phosphor-react-native';

interface AudioPlayerProps {
  uri: string;
}

export function AudioPlayer({ uri }: AudioPlayerProps) {
  // Set updateInterval to 100ms for smooth progress tracking
  const player = useAudioPlayer(uri, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  
  const isPlaying = status.playing;
  const duration = status.duration || 0;
  const position = status.currentTime || 0;

  // Animated values for simulated waveform (scaleY multiplier)
  const numBars = 20;
  const animations = useRef(Array.from({ length: numBars }).map(() => new Animated.Value(0.8))).current;

  useEffect(() => {
    let animationLoops: Animated.CompositeAnimation[] = [];
    
    if (isPlaying) {
      animationLoops = animations.map((anim, index) => {
        const sequence = Animated.sequence([
          Animated.timing(anim, {
            toValue: Math.random() * 1.5 + 1.2, // scale to 1.2 - 2.7
            duration: 350 + Math.random() * 200,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.8, // resting scale
            duration: 350 + Math.random() * 200,
            useNativeDriver: true,
          })
        ]);
        const loop = Animated.loop(sequence);
        setTimeout(() => loop.start(), index * 50);
        return loop;
      });
    } else {
      animations.forEach(anim => {
        Animated.timing(anim, {
          toValue: 0.8, // Reset to resting scale
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }

    return () => {
      animationLoops.forEach(loop => loop.stop());
    };
  }, [isPlaying]);

  const togglePlayback = () => {
    if (isPlaying) {
      player.pause();
    } else {
      if (position >= duration && duration > 0) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;
  
  // Show duration initially or when finished. Otherwise, show current position.
  const displaySeconds = (!isPlaying && (position === 0 || position >= duration)) 
    ? duration 
    : position;

  return (
    <View className="bg-white rounded-full p-2 flex-row items-center w-full shadow-sm border border-neutral-100">
      <TouchableOpacity 
        onPress={togglePlayback}
        className="w-11 h-11 bg-terracotta rounded-full items-center justify-center mr-3"
      >
        {isPlaying ? (
          <Pause size={18} color="#FFFFFF" weight="fill" />
        ) : (
          <Play size={18} color="#FFFFFF" weight="fill" style={{ marginLeft: 2 }} />
        )}
      </TouchableOpacity>
      
      <View className="flex-1 flex-row items-center h-full mr-3 relative">
        {/* Waveform Visualization */}
        <View className="flex-row items-center justify-between w-full h-8 overflow-hidden rounded-full">
          {animations.map((anim, index) => {
            const isPastProgress = (index / numBars) * 100 <= progressPercentage;
            return (
              <Animated.View 
                key={index}
                style={{
                  height: 8,
                  width: 3,
                  backgroundColor: isPastProgress ? '#E06D53' : '#E5E5E5',
                  borderRadius: 2,
                  transform: [{ scaleY: anim }]
                }}
              />
            )
          })}
        </View>
      </View>

      <Text className="text-xs font-sans-medium text-neutral-400 mr-2 w-8 text-right">
        {formatTime(displaySeconds)}
      </Text>
    </View>
  );
}
