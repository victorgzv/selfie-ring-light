import { type ReactNode, memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { angleFromCentre, arcPath, shortestAngleDelta } from '@/lib/geometry';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Total travel of the knob, leaving a gap at the bottom like real hardware. */
const SWEEP_DEGREES = 270;
/** Clockwise offset of 0% from 12 o'clock — i.e. 7:30. */
const START_DEGREES = 225;
/** Detents per full sweep. 20 gives a 5% step, which feels like a click wheel. */
const DETENTS = 20;

type Props = {
  /** Outer diameter of the dial. */
  size: number;
  /** 0–1 dial position. Owned by the parent, written here from the gesture. */
  dial: SharedValue<number>;
  /** Radius of the untouchable button in the middle. */
  centreRadius: number;
  /** Accent used for the filled part of the arc and the marker. */
  accent: string;
  /** Called on the JS thread when the drag ends, for persistence. Keep stable. */
  onCommit: (value: number) => void;
  /** Fired once per detent while dragging. Keep stable. */
  onTick: () => void;
  children: ReactNode;
};

function IntensityDialImpl({
  size,
  dial,
  centreRadius,
  accent,
  onCommit,
  onTick,
  children,
}: Props) {
  const centre = size / 2;
  const trackRadius = centre - 13;
  const circumference = 2 * Math.PI * trackRadius;
  /** Length of the live part of the circle: the rest is the bottom gap. */
  const arcLength = circumference * (SWEEP_DEGREES / 360);
  const dashPattern = `${arcLength} ${circumference}`;
  /** Rotation that moves an SVG circle's 3 o'clock start to our 0% position. */
  const startRotation = `rotate(${START_DEGREES - 90} ${centre} ${centre})`;
  const segments = useMemo(
    () => arcPath(centre, centre - 3, START_DEGREES, SWEEP_DEGREES),
    [centre],
  );

  /** 1 while a finger owns the dial — drives the grab feedback. */
  const grabbed = useSharedValue(0);
  /** Angle under the finger on the previous frame, for delta accumulation. */
  const lastAngle = useSharedValue(0);
  /** Set when the gesture starts on the shutter, so we leave the button alone. */
  const ignoring = useSharedValue(false);
  /** Last detent we buzzed on, so one drag does not machine-gun the taptic. */
  const lastDetent = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Lets a tap fall through to the shutter button underneath.
        .minDistance(6)
        .onBegin((event) => {
          const distance = Math.hypot(event.x - centre, event.y - centre);
          // Ignore touches on the shutter itself and any that start well
          // outside the ring, so the dial only responds where it looks live.
          ignoring.value = distance < centreRadius + 6 || distance > centre + 26;
          if (ignoring.value) return;

          lastAngle.value = angleFromCentre(centre, event.x, event.y);
          lastDetent.value = Math.round(dial.value * DETENTS);
          grabbed.value = withTiming(1, { duration: 140 });
        })
        .onUpdate((event) => {
          if (ignoring.value) return;

          const angle = angleFromCentre(centre, event.x, event.y);
          // Accumulating the shortest delta rather than mapping the raw angle
          // keeps the knob from teleporting when the finger crosses the gap.
          const delta = shortestAngleDelta(lastAngle.value, angle);
          lastAngle.value = angle;

          const next = dial.value + delta / SWEEP_DEGREES;
          dial.value = next < 0 ? 0 : next > 1 ? 1 : next;

          const detent = Math.round(dial.value * DETENTS);
          if (detent !== lastDetent.value) {
            lastDetent.value = detent;
            runOnJS(onTick)();
          }
        })
        .onFinalize(() => {
          if (ignoring.value) {
            ignoring.value = false;
            return;
          }
          grabbed.value = withTiming(0, { duration: 220 });
          runOnJS(onCommit)(dial.value);
        }),
    [centre, centreRadius, dial, grabbed, ignoring, lastAngle, lastDetent, onCommit, onTick],
  );

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLength * (1 - dial.value),
  }));

  const markerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${START_DEGREES + dial.value * SWEEP_DEGREES}deg` },
      { scale: 1 + 0.12 * grabbed.value },
    ],
  }));

  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.03 * grabbed.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + 0.4 * grabbed.value + 0.18 * dial.value,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ width: size, height: size }, shellStyle]}>
        {/* Faint bloom under the knob so it reads as lit hardware. */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, glowStyle]}>
          <Svg width={size} height={size}>
            <Circle
              cx={centre}
              cy={centre}
              r={trackRadius}
              stroke={accent}
              strokeWidth={16}
              strokeOpacity={0.16}
              fill="none"
              strokeDasharray={dashPattern}
              strokeLinecap="round"
              transform={startRotation}
            />
          </Svg>
        </Animated.View>

        <Svg
          width={size}
          height={size}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          {/* Decorative segment ticks. Drawn on an arc path rather than a full
              circle so none of them land in the bottom gap. */}
          <Path
            d={segments}
            stroke="#FFFFFF"
            strokeOpacity={0.22}
            strokeWidth={5}
            fill="none"
            strokeDasharray="1.5 9"
          />
          {/* SVG circles start at 3 o'clock, so each arc is rotated back by 90°
              before the start offset is applied. */}
          <G transform={startRotation}>
            <Circle
              cx={centre}
              cy={centre}
              r={trackRadius}
              stroke="#FFFFFF"
              strokeOpacity={0.13}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={dashPattern}
            />
            <AnimatedCircle
              cx={centre}
              cy={centre}
              r={trackRadius}
              stroke={accent}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={dashPattern}
              animatedProps={arcProps}
            />
          </G>
        </Svg>

        {/* The marker sits at 12 o'clock and the whole layer is rotated, which
            is cheaper than recomputing its position every frame. */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, markerStyle]}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: centre - 1.75,
              width: 3.5,
              height: 16,
              borderRadius: 2,
              backgroundColor: accent,
            }}
          />
        </Animated.View>

        <View style={StyleSheet.absoluteFill} className="items-center justify-center">
          {children}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export const IntensityDial = memo(IntensityDialImpl);
