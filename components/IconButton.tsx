import { type ReactNode, memo } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  children: ReactNode;
  /** Filled with the accent instead of the usual translucent slate. */
  active?: boolean;
  accent?: string;
  size?: number;
  disabled?: boolean;
};

const SPRING = { damping: 14, stiffness: 320, mass: 0.5 } as const;

/** Round translucent control used for every chrome button on the light screen. */
function IconButtonImpl({
  onPress,
  accessibilityLabel,
  children,
  active = false,
  accent = '#FFD400',
  size = 44,
  disabled = false,
}: Props) {
  const pressed = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.09 * pressed.value }],
    opacity: disabled ? 0.35 : 1 - 0.15 * pressed.value,
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPressIn={() => {
        pressed.value = withSpring(1, SPRING);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, SPRING);
      }}
      onPress={onPress}
    >
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size * 0.3,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: active ? accent : 'rgba(255,255,255,0.10)',
          },
          style,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

export const IconButton = memo(IconButtonImpl);
