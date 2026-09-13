import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { ringLayerLevel, rgbToCss, type Rgb } from '@/lib/colour';
import { buildDotField, dotsToPath } from '@/lib/geometry';
import type { RingStyleId } from '@/lib/presets';

type Props = {
  /** Full stage box. Flood mode lights all of it. */
  width: number;
  height: number;
  /** Side of the square the ring itself is drawn into, centred in the box. */
  size: number;
  /** Radius of the hole the camera preview sits in. */
  windowRadius: number;
  /** Full-strength emitted colour for the current temperature. */
  colour: Rgb;
  ringStyle: RingStyleId;
  /** 0–1 emitted-light factor, already curved. Lives on the UI thread. */
  output: SharedValue<number>;
  /** False dims everything to nothing without unmounting the SVG. */
  active: boolean;
};

/** Milliseconds per revolution per dot layer. Negative runs anticlockwise, so
 *  the field shimmers instead of looking like one rigid wheel. */
const LAYER_SPINS = [26000, -34000, 44000] as const;

/**
 * Applies the breathing swell with an amplitude that shrinks to nothing as the
 * light approaches full.
 *
 * The swell used to be a flat percentage at every level, which meant 100% was
 * really an oscillation between about 82% and 100% — up to a fifth of the
 * output given away for an effect nobody asked for at the top of the dial.
 * Now the ring is alive when it is dim and rock steady when it is maxed.
 */
function breathe(level: number, breath: number, amplitude: number): number {
  'worklet';
  return level * (1 - amplitude * (1 - level) * breath);
}

/**
 * The light itself.
 *
 * Everything is painted above the camera preview, which is what lets the ring
 * sit flush against a round window on Android — where the camera renders into
 * a surface that ignores a parent's rounded clip. The preview's square corners
 * are covered by a black mask inside `CameraWindow`, and this component then
 * draws over that mask, so no layer ever eats the dots.
 */
function RingLightImpl({
  width,
  height,
  size,
  windowRadius,
  colour,
  ringStyle,
  output,
  active,
}: Props) {
  const centre = size / 2;
  const fill = rgbToCss(colour);
  /** Where transparency ends and light begins, as a gradient offset. */
  const windowStop = Math.min(0.9, windowRadius / centre);
  /** Where the bloom is allowed to start, a little outside the window. */
  const haloStart = Math.min(0.95, windowStop * 1.18);

  const dotPaths = useMemo(() => {
    if (ringStyle !== 'dots') return [];
    return buildDotField(size, windowRadius).map((ring) => ({
      d: dotsToPath(ring.dots),
      radius: ring.radius,
    }));
  }, [ringStyle, size, windowRadius]);

  /** Whole stage minus the camera window: the shape flood mode lights up. */
  const floodPath = useMemo(() => {
    if (ringStyle !== 'flood') return '';
    const cx = width / 2;
    const cy = height / 2;
    const r = windowRadius + 2;
    return `M0,0 H${width} V${height} H0 Z M${cx},${cy - r} A${r},${r} 0 1,0 ${cx},${cy + r} A${r},${r} 0 1,0 ${cx},${cy - r} Z`;
  }, [height, ringStyle, width, windowRadius]);

  /** Continuous 0→1 ramps, one per layer, converted to degrees at use. */
  const spin0 = useSharedValue(0);
  const spin1 = useSharedValue(0);
  const spin2 = useSharedValue(0);
  /** Slow in-out swell so the light feels alive rather than static. */
  const breath = useSharedValue(0);
  /** Springs to 1 whenever the light is switched on. */
  const presence = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    const layers = [spin0, spin1, spin2];
    layers.forEach((value, index) => {
      const duration = Math.abs(LAYER_SPINS[index] ?? 30000);
      value.value = 0;
      value.value = withRepeat(
        withTiming(1, { duration, easing: Easing.linear }),
        -1,
        false,
      );
    });

    breath.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    return () => {
      layers.forEach(cancelAnimation);
      cancelAnimation(breath);
    };
  }, [breath, spin0, spin1, spin2]);

  useEffect(() => {
    presence.value = withSpring(active ? 1 : 0, {
      damping: 18,
      stiffness: 120,
      mass: 0.9,
    });
  }, [active, presence]);

  /** What every layer multiplies its opacity by. */
  const level = useDerivedValue(() => output.value * presence.value);

  const floodStyle = useAnimatedStyle(() => ({
    opacity: level.value,
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: breathe(level.value, breath.value, 0.3),
    transform: [{ scale: 0.94 + 0.1 * level.value }],
  }));

  const solidStyle = useAnimatedStyle(() => ({
    opacity: breathe(level.value, breath.value, 0.14),
    transform: [{ scale: 0.985 + 0.015 * level.value }],
  }));

  const layer0 = useLayerStyle(spin0, level, breath, LAYER_SPINS[0], 0);
  const layer1 = useLayerStyle(spin1, level, breath, LAYER_SPINS[1], 1);
  const layer2 = useLayerStyle(spin2, level, breath, LAYER_SPINS[2], 2);
  const layerStyles = [layer0, layer1, layer2];

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centre]}>
      {ringStyle === 'flood' && (
        <Animated.View style={[StyleSheet.absoluteFill, floodStyle]}>
          <Svg width={width} height={height}>
            {/* evenodd turns the circle sub-path into a hole, so the preview
                stays visible while everything around it is lit. */}
            <Path d={floodPath} fill={fill} fillRule="evenodd" />
          </Svg>
        </Animated.View>
      )}

      <View style={{ width: size, height: size }}>
        {/* Bloom: light spilling past the ring onto the black. This is what
            sells the illusion that the panel is actually glowing. Max mode
            skips it — there is nothing dark left for it to bloom into. */}
        {ringStyle !== 'screen' && (
        <Animated.View style={[StyleSheet.absoluteFill, haloStyle]}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="haloGradient" cx="50%" cy="50%" r="50%">
                {/* Hard transparent core: without an explicit stop at 0 the
                    gradient would clamp outward and wash over the preview. */}
                <Stop offset="0" stopColor={fill} stopOpacity={0} />
                <Stop offset={windowStop} stopColor={fill} stopOpacity={0} />
                {/* The bloom starts clear of the preview: glow lapping right up
                    against the window looks like haze on the lens. */}
                <Stop offset={haloStart} stopColor={fill} stopOpacity={0.1} />
                <Stop offset={haloStart + (1 - haloStart) * 0.4} stopColor={fill} stopOpacity={0.42} />
                <Stop offset="0.92" stopColor={fill} stopOpacity={0.16} />
                <Stop offset="1" stopColor={fill} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={centre} cy={centre} r={centre} fill="url(#haloGradient)" />
          </Svg>
        </Animated.View>
        )}

        {ringStyle === 'dots' &&
          dotPaths.map((ring, index) => (
            <Animated.View
              key={ring.radius}
              style={[StyleSheet.absoluteFill, layerStyles[index]]}
            >
              <Svg width={size} height={size}>
                <Path d={ring.d} fill={fill} />
              </Svg>
            </Animated.View>
          ))}

        {ringStyle === 'halo' && (
          <Animated.View style={[StyleSheet.absoluteFill, solidStyle]}>
            <Svg width={size} height={size}>
              <Circle
                cx={centre}
                cy={centre}
                r={(windowRadius + centre) / 2}
                stroke={fill}
                strokeWidth={Math.max(4, centre - windowRadius - 6)}
                fill="none"
              />
            </Svg>
          </Animated.View>
        )}

        {ringStyle === 'beauty' && (
          <Animated.View style={[StyleSheet.absoluteFill, solidStyle]}>
            <Svg width={size} height={size}>
              <Defs>
                <RadialGradient id="beautyGradient" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={fill} stopOpacity={0} />
                  <Stop offset={windowStop} stopColor={fill} stopOpacity={0} />
                  <Stop offset={windowStop * 0.35 + 0.65} stopColor={fill} stopOpacity={1} />
                  <Stop offset="0.95" stopColor={fill} stopOpacity={0.4} />
                  <Stop offset="1" stopColor={fill} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={centre} cy={centre} r={centre} fill="url(#beautyGradient)" />
            </Svg>
          </Animated.View>
        )}

        {ringStyle === 'flood' && (
          // The panel behind is doing the work here, so all that is left is a
          // bright rim to keep a catchlight in the eye.
          <Animated.View style={[StyleSheet.absoluteFill, solidStyle]}>
            <Svg width={size} height={size}>
              <Circle
                cx={centre}
                cy={centre}
                r={windowRadius + 9}
                stroke={fill}
                strokeWidth={14}
                fill="none"
              />
            </Svg>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

/**
 * One rotating dot layer. Split into its own hook because hooks cannot be
 * called from inside a loop body.
 */
function useLayerStyle(
  spin: SharedValue<number>,
  level: SharedValue<number>,
  breath: SharedValue<number>,
  spinMs: number | undefined,
  index: number,
) {
  const direction = (spinMs ?? 1) < 0 ? -1 : 1;
  /** Offsets each layer's swell so they breathe out of step with each other. */
  const phase = index * 0.33;

  return useAnimatedStyle(() => {
    const wave = 0.5 + 0.5 * Math.sin((breath.value + phase) * Math.PI * 2);
    const visible = ringLayerLevel(level.value, index);

    return {
      opacity: breathe(visible, wave, 0.18),
      transform: [
        { rotate: `${spin.value * 360 * direction}deg` },
        { scale: 0.97 + 0.03 * visible },
      ],
    };
  });
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
});

export const RingLight = memo(RingLightImpl);
