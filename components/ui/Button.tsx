import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  type TouchableOpacityProps,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type ButtonVariant = "primary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<TouchableOpacityProps, "style"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  label: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-2 min-h-[44px] justify-center items-center",
  md: "px-6 py-3.5 min-h-[48px] justify-center items-center",
  lg: "px-8 py-4 min-h-[56px] justify-center items-center",
};

const labelSizeStyles: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

const variantContainerStyles: Record<ButtonVariant, string> = {
  primary: "bg-terracotta border border-terracotta",
  outline: "bg-transparent border border-terracotta",
  ghost: "bg-transparent border border-transparent",
};

const variantLabelStyles: Record<ButtonVariant, string> = {
  primary: "text-white",
  outline: "text-terracotta",
  ghost: "text-terracotta",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  label,
  leftIcon,
  rightIcon,
  disabled,
  onPress,
  ...rest
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePressIn() {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  }

  function handlePressOut() {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }

  const isDisabled = disabled || loading;

  return (
    <AnimatedTouchable
      style={animatedStyle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      {...rest}
      className={[
        "flex-row items-center justify-center rounded-full",
        sizeStyles[size],
        variantContainerStyles[variant],
        isDisabled ? "opacity-50" : "",
      ].join(" ")}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? "#FFFFFF" : "#E06D53"}
        />
      ) : (
        <>
          {leftIcon && <View className="mr-2">{leftIcon}</View>}
          <Text
            className={[
              "font-sans-semibold tracking-wide",
              labelSizeStyles[size],
              variantLabelStyles[variant],
            ].join(" ")}
          >
            {label}
          </Text>
          {rightIcon && <View className="ml-2">{rightIcon}</View>}
        </>
      )}
    </AnimatedTouchable>
  );
}
