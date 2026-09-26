import { ReactNode, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  GestureResponderEvent,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  UIManager,
  ViewStyle,
  TouchableOpacityProps,
} from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ease = Easing.out(Easing.cubic);

export function easeLayout() {
  LayoutAnimation.configureNext({
    duration: 220,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}

export function SoftTouch({
  style,
  children,
  disabled,
  onPressIn,
  onPressOut,
  activeOpacity: _activeOpacity,
  ...rest
}: TouchableOpacityProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  function settle(pressed: boolean) {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: pressed ? 0.985 : 1,
        duration: pressed ? 80 : 180,
        easing: ease,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: pressed ? 0.82 : 1,
        duration: pressed ? 80 : 180,
        easing: ease,
        useNativeDriver: true,
      }),
    ]).start();
  }

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event: GestureResponderEvent) => {
        if (!disabled) settle(true);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        settle(false);
        onPressOut?.(event);
      }}
      style={[style, { opacity, transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function Reveal({ children, style, delay = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const opacity = useRef(new Animated.Value(0.72)).current;
  const shift = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, delay, easing: ease, useNativeDriver: true }),
      Animated.timing(shift, { toValue: 0, duration: 240, delay, easing: ease, useNativeDriver: true }),
    ]).start();
  }, [delay, opacity, shift]);

  return <Animated.View style={[styles.fill, style, { opacity, transform: [{ translateY: shift }] }]}>{children}</Animated.View>;
}

export function GrowBar({ percent, color, style }: { percent: number; color: string; style?: StyleProp<ViewStyle> }) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(value, {
      toValue: Math.max(0, Math.min(100, percent)),
      duration: 460,
      easing: ease,
      useNativeDriver: false,
    }).start();
  }, [percent, value]);

  const width = value.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return <Animated.View style={[style, { width, backgroundColor: color }]} />;
}

export function CheckPop({ on, children }: { on: boolean; children: ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const wasOn = useRef(on);

  useEffect(() => {
    if (on && !wasOn.current) {
      scale.setValue(0.84);
      Animated.timing(scale, { toValue: 1, duration: 160, easing: ease, useNativeDriver: true }).start();
    }
    wasOn.current = on;
  }, [on, scale]);

  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
