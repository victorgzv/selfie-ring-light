import { memo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

type Props = {
  dial: SharedValue<number>;
  /** What the light is set to, e.g. "Warm 3400K" or "Max · pure white". */
  detail: string;
  accent: string;
  lightOn: boolean;
};

/**
 * One line describing the current light: "68% · Warm 3400K".
 *
 * The percentage is kept in this leaf's own state and driven by a reaction on
 * the dial, so a drag re-renders forty characters of text rather than the whole
 * capture screen. The reaction only fires when the whole number changes, which
 * caps it at one render per frame however fast the finger moves.
 */
function LightReadoutImpl({ dial, detail, accent, lightOn }: Props) {
  const [percent, setPercent] = useState(() => Math.round(dial.value * 100));

  useAnimatedReaction(
    () => Math.round(dial.value * 100),
    (next, previous) => {
      if (next !== previous) runOnJS(setPercent)(next);
    },
    [],
  );

  const style = useAnimatedStyle(() => ({
    opacity: withTiming(lightOn ? 1 : 0.35, { duration: 200 }),
  }));

  return (
    <Animated.View style={style} className="flex-row items-center justify-center gap-2">
      <Text
        // Tabular figures keep the row from twitching as the digits change.
        style={{ color: accent, fontVariant: ['tabular-nums'] }}
        className="text-[15px] font-semibold"
      >
        {percent}%
      </Text>
      <View className="h-1 w-1 rounded-full bg-white/25" />
      <Text className="text-[13px] font-medium text-white/55">{detail}</Text>
    </Animated.View>
  );
}

export const LightReadout = memo(LightReadoutImpl);
