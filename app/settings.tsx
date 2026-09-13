import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { CheckIcon, CloseIcon } from '@/components/icons';
import { kelvinToRgb, rgbToCss } from '@/lib/colour';
import { selectHaptic, testHaptics } from '@/lib/haptics';
import { RING_STYLES, TEMPERATURES } from '@/lib/presets';
import { useLightStore } from '@/lib/store';

const ACCENT = '#FFD400';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [hapticsResult, setHapticsResult] = useState<string | null>(null);

  const ringStyleId = useLightStore((s) => s.ringStyleId);
  const setRingStyleId = useLightStore((s) => s.setRingStyleId);
  const temperatureId = useLightStore((s) => s.temperatureId);
  const setTemperatureId = useLightStore((s) => s.setTemperatureId);
  const mirrorPreview = useLightStore((s) => s.mirrorPreview);
  const setMirrorPreview = useLightStore((s) => s.setMirrorPreview);
  const syncScreenBrightness = useLightStore((s) => s.syncScreenBrightness);
  const setSyncScreenBrightness = useLightStore((s) => s.setSyncScreenBrightness);
  const hapticsEnabled = useLightStore((s) => s.hapticsEnabled);
  const setHapticsEnabled = useLightStore((s) => s.setHapticsEnabled);

  return (
    <View className="flex-1 bg-ink" style={{ paddingTop: insets.top }}>
      <View className="h-14 flex-row items-center justify-between px-5">
        <Text className="text-[17px] font-semibold text-white">Light</Text>
        <IconButton accessibilityLabel="Close settings" onPress={() => router.back()}>
          <CloseIcon colour="#FFFFFF" />
        </IconButton>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        className="px-5"
        showsVerticalScrollIndicator={false}
      >
        <Section
          title="Ring style"
          caption="Changes the shape of the catchlight in your eyes."
        >
          {RING_STYLES.map((style) => (
            <Row
              key={style.id}
              title={style.label}
              caption={style.hint}
              selected={ringStyleId === style.id}
              onPress={() => {
                selectHaptic();
                setRingStyleId(style.id);
              }}
            />
          ))}
        </Section>

        <Section
          title="Colour temperature"
          caption="Match the light already in the room, or deliberately fight it."
        >
          {TEMPERATURES.map((temperature) => (
            <Row
              key={temperature.id}
              title={`${temperature.label} · ${temperature.kelvin}K`}
              caption={temperature.hint}
              selected={temperatureId === temperature.id}
              onPress={() => {
                selectHaptic();
                setTemperatureId(temperature.id);
              }}
              swatch={rgbToCss(kelvinToRgb(temperature.kelvin))}
            />
          ))}
        </Section>

        <Section title="Behaviour">
          <Toggle
            title="Boost screen brightness"
            caption="Drives the backlight from the intensity dial. Your original brightness is restored when you leave."
            value={syncScreenBrightness}
            onChange={setSyncScreenBrightness}
          />
          <Toggle
            title="Mirror preview"
            caption="Shows the front camera the way a mirror would. Does not affect the saved file."
            value={mirrorPreview}
            onChange={setMirrorPreview}
          />
          <Toggle
            title="Haptics"
            caption="Taps on the intensity dial and the shutter."
            value={hapticsEnabled}
            onChange={setHapticsEnabled}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Test haptics"
            onPress={() => {
              setHapticsResult(null);
              void testHaptics().then(setHapticsResult);
            }}
            className="border-b border-ink-line px-4 py-3.5"
          >
            <Text className="text-[15px] font-medium" style={{ color: ACCENT }}>
              Test haptics
            </Text>
            <Text className="mt-0.5 text-[12px] leading-4 text-white/40">
              {hapticsResult ??
                'Fires three taps. If you feel nothing, the cause is below the app.'}
            </Text>
          </Pressable>
        </Section>

        <Section title="Tips">
          <Text className="px-1 text-[13px] leading-6 text-white/50">
            Swipe up and down anywhere on the light to change intensity, or turn
            the ring around the shutter for finer control. Drag the curved row of
            names to change colour temperature. Tap the light to hide the controls
            for a clean panel, and tap again to bring them back.
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <View className="mb-7">
      <Text className="mb-1 px-1 text-[12px] font-semibold uppercase tracking-[1.4px] text-white/40">
        {title}
      </Text>
      {caption ? (
        <Text className="mb-3 px-1 text-[13px] leading-5 text-white/35">{caption}</Text>
      ) : (
        <View className="h-2" />
      )}
      <View className="overflow-hidden rounded-2xl bg-ink-raised">{children}</View>
    </View>
  );
}

function Row({
  title,
  caption,
  selected,
  onPress,
  swatch,
}: {
  title: string;
  caption: string;
  selected: boolean;
  onPress: () => void;
  swatch?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="flex-row items-center gap-3 border-b border-ink-line px-4 py-3.5"
    >
      {swatch ? (
        <View
          className="h-6 w-6 rounded-full border border-white/15"
          style={{ backgroundColor: swatch }}
        />
      ) : null}

      <View className="flex-1">
        <Text className="text-[15px] font-medium text-white">{title}</Text>
        <Text className="mt-0.5 text-[12px] leading-4 text-white/40">{caption}</Text>
      </View>

      <View className="h-5 w-5 items-center justify-center">
        {selected ? <CheckIcon size={18} colour={ACCENT} weight={2.4} /> : null}
      </View>
    </Pressable>
  );
}

function Toggle({
  title,
  caption,
  value,
  onChange,
}: {
  title: string;
  caption: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View className="flex-row items-center gap-3 border-b border-ink-line px-4 py-3.5">
      <View className="flex-1">
        <Text className="text-[15px] font-medium text-white">{title}</Text>
        <Text className="mt-0.5 text-[12px] leading-4 text-white/40">{caption}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: 'rgba(255,255,255,0.16)', true: ACCENT }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="rgba(255,255,255,0.16)"
      />
    </View>
  );
}
