import { memo, useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  size: number;
  recording: boolean;
  /** Blocks input while a capture is in flight or a countdown is running. */
  busy: boolean;
  onPress: () => void;
};

const PRESS_SPRING = { damping: 15, stiffness: 340, mass: 0.6 } as const;

/**
 * The white ring-and-disc shutter from the reference.
 *
 * The inner disc is one view that morphs: it rounds down to a square and turns
 * red for recording, which reads instantly and avoids swapping icons mid-press.
 */
function ShutterButtonImpl({ size, recording, busy, onPress }: Props) {
  const pressed = useSharedValue(0);
  const record = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    record.value = withSpring(recording ? 1 : 0, { damping: 17, stiffness: 210 });

    if (recording) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
    }

    return () => cancelAnimation(pulse);
  }, [pulse, record, recording]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.05 * pressed.value }],
    opacity: busy && record.value === 0 ? 0.55 : 1,
  }));

  const innerSize = size - 14;

  const innerStyle = useAnimatedStyle(() => {
    const r = record.value;
    return {
      width: innerSize * (1 - 0.42 * r),
      height: innerSize * (1 - 0.42 * r),
      borderRadius: (innerSize / 2) * (1 - 0.78 * r),
      backgroundColor: r > 0.5 ? '#FF3B30' : '#FFFFFF',
      transform: [{ scale: (1 - 0.08 * pressed.value) * (1 - 0.06 * pulse.value * r) }],
    };
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Stop recording' : 'Take photo'}
      accessibilityState={{ disabled: busy && !recording, busy }}
      disabled={busy && !recording}
      onPressIn={() => {
        pressed.value = withSpring(1, PRESS_SPRING);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, PRESS_SPRING);
      }}
      onPress={onPress}
      hitSlop={8}
    >
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 3,
            borderColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
          },
          ringStyle,
        ]}
      >
        <Animated.View style={innerStyle} />
      </Animated.View>
    </Pressable>
  );
}

export const ShutterButton = memo(ShutterButtonImpl);
