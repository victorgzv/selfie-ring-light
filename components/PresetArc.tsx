import { memo, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { TEMPERATURES, type TemperatureId } from '@/lib/presets';

/** Radius of the invisible wheel the labels are mounted on. */
const WHEEL_RADIUS = 250;
/** Angular gap between neighbouring labels. */
const STEP_DEGREES = 15;
/** Finger travel that advances one label. */
const DRAG_PER_ITEM = 74;

const SPRING = { damping: 20, stiffness: 190, mass: 0.7 } as const;

type Props = {
  selected: TemperatureId;
  accent: string;
  onSelect: (id: TemperatureId) => void;
  /** Fired when the wheel lands on a new label. Keep stable. */
  onStep: () => void;
};

/**
 * The curved label track from the reference hardware UI, turned into the
 * colour-temperature selector.
 *
 * Labels are mounted on an imaginary wheel below the row, so dragging spins
 * them along an arc instead of sliding them in a straight line. A ScrollView
 * would have been less code but could not tilt each label to match its
 * position on the curve, which is the whole character of the control.
 */
function PresetArcImpl({ selected, accent, onSelect, onStep }: Props) {
  const count = TEMPERATURES.length;
  const selectedIndex = useMemo(
    () => Math.max(0, TEMPERATURES.findIndex((t) => t.id === selected)),
    [selected],
  );

  /** Fractional index at the centre of the arc. */
  const wheel = useSharedValue(selectedIndex);
  /** Wheel position when the current drag began. */
  const dragOrigin = useSharedValue(selectedIndex);
  /** Last index we reported, so a drag past several labels buzzes for each. */
  const lastReported = useSharedValue(selectedIndex);
  /** Distinguishes a clean release from a cancelled gesture in onFinalize. */
  const settled = useSharedValue(true);

  // Keep the wheel honest when something else changes the temperature —
  // a tap on a label, or the value coming back from storage.
  useEffect(() => {
    wheel.value = withSpring(selectedIndex, SPRING);
    lastReported.value = selectedIndex;
  }, [lastReported, selectedIndex, wheel]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        // Let the vertical brightness swipe on the light area win instead.
        .failOffsetY([-14, 14])
        .onBegin(() => {
          dragOrigin.value = wheel.value;
          settled.value = false;
        })
        .onUpdate((event) => {
          const last = count - 1;
          const next = dragOrigin.value - event.translationX / DRAG_PER_ITEM;
          // Rubber-band past the ends rather than stopping dead.
          const overshoot =
            next < 0 ? next * 0.35 : next > last ? last + (next - last) * 0.35 : next;
          wheel.value = overshoot;

          const nearest = Math.round(Math.max(0, Math.min(last, overshoot)));
          if (nearest !== lastReported.value) {
            lastReported.value = nearest;
            runOnJS(onStep)();
          }
        })
        .onEnd((event) => {
          // A flick should carry to the next label even if the finger stopped
          // short of it, which is what the velocity term buys.
          const projected = wheel.value - event.velocityX / DRAG_PER_ITEM / 6;
          const target = Math.max(0, Math.min(count - 1, Math.round(projected)));
          wheel.value = withSpring(target, SPRING);
          lastReported.value = target;
          settled.value = true;

          const picked = TEMPERATURES[target];
          if (picked) runOnJS(onSelect)(picked.id);
        })
        .onFinalize(() => {
          // A cancelled gesture never reaches onEnd, which would strand the
          // wheel mid-drag — possibly rubber-banded off the end of the track.
          if (settled.value) return;
          settled.value = true;
          const target = Math.max(0, Math.min(count - 1, Math.round(wheel.value)));
          wheel.value = withSpring(target, SPRING);
          lastReported.value = target;
        }),
    [count, dragOrigin, lastReported, onSelect, onStep, settled, wheel],
  );

  return (
    <GestureDetector gesture={pan}>
      <View className="h-[74px] w-full justify-start overflow-hidden">
        {TEMPERATURES.map((temperature, index) => (
          <ArcLabel
            key={temperature.id}
            index={index}
            label={temperature.label}
            wheel={wheel}
            accent={accent}
            onPress={() => onSelect(temperature.id)}
          />
        ))}
        {/* Fixed pointer marking the selection position on the arc. */}
        <View
          pointerEvents="none"
          style={[styles.pointer, { backgroundColor: accent }]}
        />
      </View>
    </GestureDetector>
  );
}

type ArcLabelProps = {
  index: number;
  label: string;
  wheel: SharedValue<number>;
  accent: string;
  onPress: () => void;
};

function ArcLabel({ index, label, wheel, accent, onPress }: ArcLabelProps) {
  const placement = useAnimatedStyle(() => {
    const offset = index - wheel.value;
    const radians = (offset * STEP_DEGREES * Math.PI) / 180;
    const distance = Math.abs(offset);

    return {
      transform: [
        { translateX: WHEEL_RADIUS * Math.sin(radians) },
        { translateY: WHEEL_RADIUS * (1 - Math.cos(radians)) },
        { rotate: `${offset * STEP_DEGREES}deg` },
        { scale: Math.max(0.62, 1 - distance * 0.13) },
      ],
      opacity: Math.max(0, 1 - distance * 0.34),
    };
  });

  // Colour has to live on the Text itself — setting it on the wrapper View
  // would be silently ignored.
  const tint = useAnimatedStyle(() => ({
    color: interpolateColor(
      Math.min(Math.abs(index - wheel.value), 1),
      [0, 1],
      [accent, 'rgba(255,255,255,0.55)'],
    ),
  }));

  return (
    <Animated.View
      style={[styles.label, placement]}
      // Only the label's own Pressable should be hit-testable; the wrapper
      // spans the full width and would otherwise block its neighbours.
      pointerEvents="box-none"
    >
      <Pressable onPress={onPress} hitSlop={10} className="px-3 py-1.5">
        <Animated.Text style={[styles.text, tint]} numberOfLines={1}>
          {label}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  pointer: {
    position: 'absolute',
    bottom: 6,
    // Centred by hand: a percentage translate on a 4px dot is not worth the
    // platform differences.
    left: '50%',
    marginLeft: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

export const PresetArc = memo(PresetArcImpl);
