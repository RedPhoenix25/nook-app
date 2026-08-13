import React from "react";
import { View, type ViewProps } from "react-native";

interface CardProps extends ViewProps {
  children: React.ReactNode;
  /** Adds an extra shadow layer for depth */
  elevated?: boolean;
}

export function Card({ children, elevated = false, className = "", ...rest }: CardProps) {
  return (
    <View
      className={[
        "rounded-3xl bg-white border border-neutral-100/60 overflow-hidden",
        elevated ? "shadow-md" : "shadow-sm",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </View>
  );
}
