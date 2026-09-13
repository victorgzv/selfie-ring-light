import { CameraView, type CameraMode, type CameraType } from 'expo-camera';
import { forwardRef, memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

type Props = {
  /** Diameter of the round preview. */
  size: number;
  facing: CameraType;
  mirror: boolean;
  mode: CameraMode;
  zoom: number;
  /** Painted outside the circle — matches whatever the screen behind it is. */
  maskColour: string;
  /**
   * Opacity of a second mask laid over the first, in `floodColour`.
   *
   * In Max mode the screen behind the preview is `maskColour` with a flood of
   * `floodColour` on top at this exact opacity, so stacking the same two layers
   * here reproduces the background precisely and the square corners of the
   * preview stay invisible at every dial position. Sits at 0 in every other
   * mode, which costs nothing.
   */
  floodLevel: SharedValue<number>;
  floodColour: string;
  /** Rim tint, so the preview edge stays readable against a bright ring. */
  rimColour: string;
  granted: boolean;
  /** Suspends the capture session without unmounting (iOS). */
  active: boolean;
  mute: boolean;
  onCameraReady?: () => void;
  onMountError?: (message: string) => void;
};

/**
 * The round window in the middle of the light.
 *
 * The circle is cut with an SVG mask painted *over* the preview rather than by
 * putting a border radius on the container. Android renders the camera into a
 * surface that does not reliably respect a parent's rounded clip, so relying on
 * `overflow: 'hidden'` alone gives a square preview on some devices. Punching
 * the hole from above is the same result on every device.
 */
function CameraWindowImpl(
  {
    size,
    facing,
    mirror,
    mode,
    zoom,
    maskColour,
    floodLevel,
    floodColour,
    rimColour,
    granted,
    active,
    mute,
    onCameraReady,
    onMountError,
  }: Props,
  ref: React.ForwardedRef<CameraView>,
) {
  const radius = size / 2;
  /** Square with a centred circular hole. evenodd makes the circle a hole
   *  rather than a filled disc. */
  const donut = `M0,0 H${size} V${size} H0 Z M${radius},0 A${radius},${radius} 0 1,0 ${radius},${size} A${radius},${radius} 0 1,0 ${radius},0 Z`;

  const floodMaskStyle = useAnimatedStyle(() => ({ opacity: floodLevel.value }));

  return (
    <View style={{ width: size, height: size }}>
      {granted ? (
        <CameraView
          ref={ref}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode={mode}
          mirror={mirror}
          zoom={zoom}
          mute={mute}
          active={active}
          // The system shutter animation would fight the app's own flash.
          animateShutter={false}
          onCameraReady={onCameraReady}
          onMountError={(event) => onMountError?.(event.message)}
        />
      ) : (
        <View
          className="flex-1 items-center justify-center bg-ink-raised"
          style={{ borderRadius: radius }}
        >
          <Text className="px-8 text-center text-[13px] leading-5 text-white/45">
            Camera preview appears here
          </Text>
        </View>
      )}

      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Path d={donut} fill={maskColour} fillRule="evenodd" />
      </Svg>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, floodMaskStyle]}
      >
        <Svg width={size} height={size}>
          <Path d={donut} fill={floodColour} fillRule="evenodd" />
        </Svg>
      </Animated.View>

      {/* The rim sits just inside the circle, so neither mask covers it. */}
      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Circle
          cx={radius}
          cy={radius}
          r={radius - 0.75}
          stroke={rimColour}
          strokeWidth={1.5}
          fill="none"
        />
      </Svg>
    </View>
  );
}

export const CameraWindow = memo(forwardRef<CameraView, Props>(CameraWindowImpl));
