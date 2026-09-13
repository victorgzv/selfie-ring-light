import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraMode,
} from 'expo-camera';
import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraWindow } from '@/components/CameraWindow';
import { IconButton } from '@/components/IconButton';
import { IntensityDial } from '@/components/IntensityDial';
import { LightReadout } from '@/components/LightReadout';
import { PresetArc } from '@/components/PresetArc';
import { RingLight } from '@/components/RingLight';
import { ShutterButton } from '@/components/ShutterButton';
import {
  BoltIcon,
  FlipCameraIcon,
  PhotoIcon,
  SlidersIcon,
  SunIcon,
  TimerIcon,
  VideoIcon,
} from '@/components/icons';
import { dialToOutput, rgbToCss } from '@/lib/colour';
import {
  errorHaptic,
  heavyHaptic,
  pressHaptic,
  selectHaptic,
  successHaptic,
  tickHaptic,
} from '@/lib/haptics';
import {
  MAX_MODE_COLOUR,
  isFullScreenStyle,
  rgbForTemperature,
  temperatureById,
  type TemperatureId,
} from '@/lib/presets';
import { useLightStore, type TimerSeconds } from '@/lib/store';
import { useMediaSaver } from '@/lib/useMediaSaver';
import { useScreenBrightness } from '@/lib/useScreenBrightness';

const ACCENT = '#FFD400';
const DIAL_SIZE = 148;
const SHUTTER_SIZE = 70;
const TIMER_CHOICES: readonly TimerSeconds[] = [0, 3, 10];
/** Finger travel across the light for a full sweep of the intensity range. */
const SWIPE_RANGE = 280;
/** Detents per full sweep, matching the rotary dial's feel. */
const DETENTS = 20;
/** Hard ceiling on a clip so a forgotten recording cannot fill the device. */
const MAX_VIDEO_SECONDS = 300;

export default function LightScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

  const lightOn = useLightStore((s) => s.lightOn);
  const toggleLight = useLightStore((s) => s.toggleLight);
  const temperatureId = useLightStore((s) => s.temperatureId);
  const setTemperatureId = useLightStore((s) => s.setTemperatureId);
  const ringStyleId = useLightStore((s) => s.ringStyleId);
  const mirrorPreview = useLightStore((s) => s.mirrorPreview);
  const syncScreenBrightness = useLightStore((s) => s.syncScreenBrightness);
  const timerSeconds = useLightStore((s) => s.timerSeconds);
  const setTimerSeconds = useLightStore((s) => s.setTimerSeconds);
  const setIntensity = useLightStore((s) => s.setIntensity);
  const toggleMaxMode = useLightStore((s) => s.toggleMaxMode);

  const temperature = temperatureById(temperatureId);
  /** Max mode trades the tint for output: pure white is the brightest thing a
   *  panel can show, and any colour cast costs luminance. */
  const maxMode = isFullScreenStyle(ringStyleId);
  const colour = useMemo(
    () => (maxMode ? MAX_MODE_COLOUR : rgbForTemperature(temperatureId)),
    [maxMode, temperatureId],
  );
  const colourCss = useMemo(() => rgbToCss(colour), [colour]);

  /** Dial position, 0–1. The source of truth for the light on the UI thread. */
  const dial = useSharedValue(useLightStore.getState().intensity);
  const output = useDerivedValue(() => dialToOutput(dial.value));
  const flash = useSharedValue(0);
  /** Eases the master switch so the panel does not snap between states. */
  const lit = useSharedValue(lightOn ? 1 : 0);
  /**
   * How lit the whole panel is. Non-zero only in Max mode, where the screen
   * itself is the lamp rather than a ring drawn on it.
   */
  const floodLevel = useDerivedValue(() => (maxMode ? output.value * lit.value : 0));

  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [mode, setMode] = useState<CameraMode>('picture');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastShot, setLastShot] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chromeHidden, setChromeHidden] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Read inside callbacks that must stay stable across every settings change. */
  const settingsRef = useRef({ lightOn, syncScreenBrightness });

  const { save } = useMediaSaver();
  const { apply: applyBrightness, restore: restoreBrightness } = useScreenBrightness();

  const cameraGranted = cameraPermission?.granted ?? false;

  const say = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2400);
  }, []);

  // ── Light output ──────────────────────────────────────────────────────────

  // Declared before the effect that reads it, so the ref is fresh by the time
  // brightness is pushed.
  useEffect(() => {
    settingsRef.current = { lightOn, syncScreenBrightness };
  }, [lightOn, syncScreenBrightness]);

  useEffect(() => {
    lit.value = withTiming(lightOn ? 1 : 0, { duration: 260 });
  }, [lightOn, lit]);

  /**
   * The backlight is the biggest lever on how much light actually lands on a
   * face, so the dial drives it as well as the pixels. It never drops below a
   * third: a ring light that dims the panel to nothing is just a dark screen.
   */
  const pushBrightness = useCallback(
    (value: number) => {
      const { lightOn: on, syncScreenBrightness: sync } = settingsRef.current;
      if (!on || !sync) {
        restoreBrightness();
        return;
      }
      applyBrightness(0.35 + 0.65 * dialToOutput(value));
    },
    [applyBrightness, restoreBrightness],
  );

  useAnimatedReaction(
    () => Math.round(dial.value * 100),
    (next, previous) => {
      if (next !== previous) runOnJS(pushBrightness)(next / 100);
    },
    [pushBrightness],
  );

  useEffect(() => {
    pushBrightness(dial.value);
  }, [dial, lightOn, pushBrightness, syncScreenBrightness]);

  // Restore the saved dial position once the persisted store has loaded. The
  // sweep doubles as a power-on animation.
  useEffect(() => {
    const restoreDial = () => {
      dial.value = withTiming(useLightStore.getState().intensity, { duration: 620 });
    };

    if (useLightStore.persist.hasHydrated()) {
      restoreDial();
      return;
    }
    return useLightStore.persist.onFinishHydration(restoreDial);
  }, [dial]);

  const commitIntensity = useCallback(
    (value: number) => setIntensity(value),
    [setIntensity],
  );

  // ── Layout ────────────────────────────────────────────────────────────────

  // Leave a real gutter: a ring that touches the bezel reads as a rendering
  // bug rather than a lamp, and the glow needs somewhere to fall off into.
  const ringSize = Math.max(140, Math.min(stage.width - 44, stage.height - 28));
  const windowRadius = ringSize * 0.295;

  // ── Capture ───────────────────────────────────────────────────────────────

  const clearTimers = useCallback(() => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    if (elapsedTimer.current) {
      clearInterval(elapsedTimer.current);
      elapsedTimer.current = null;
    }
  }, []);

  const ensureMediaAccess = useCallback(async () => {
    if (mediaPermission?.granted) return true;
    const result = await requestMediaPermission();
    return result.granted;
  }, [mediaPermission?.granted, requestMediaPermission]);

  const persist = useCallback(
    async (uri: string, kind: 'Photo' | 'Video') => {
      if (!(await ensureMediaAccess())) {
        errorHaptic();
        say('Allow photo access to save captures');
        return;
      }

      const result = await save(uri);
      if (result.ok) {
        if (result.uri) setLastShot(result.uri);
        successHaptic();
        say(`${kind} saved to Halo`);
      } else {
        errorHaptic();
        say(result.reason);
      }
    },
    [ensureMediaAccess, save, say],
  );

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);

    // A brief white bloom over the preview: it confirms the shot and reads as
    // the ring firing, which is what the light is doing at that moment anyway.
    flash.value = withSequence(
      withTiming(0.85, { duration: 60 }),
      withTiming(0, { duration: 260 }),
    );
    pressHaptic();

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.95,
        shutterSound: false,
      });
      if (photo?.uri) await persist(photo.uri, 'Photo');
    } catch (error) {
      errorHaptic();
      say(error instanceof Error ? error.message : 'Could not take that photo');
    } finally {
      setBusy(false);
    }
  }, [busy, flash, persist, say]);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || recording) return;

    if (!micPermission?.granted) {
      const result = await requestMicPermission();
      if (!result.granted) say('Recording without sound — microphone denied');
    }

    setRecording(true);
    setElapsed(0);
    heavyHaptic();
    elapsedTimer.current = setInterval(() => setElapsed((s) => s + 1), 1000);

    try {
      // Resolves only once recording stops, whether by the button or the cap.
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_VIDEO_SECONDS,
      });
      if (video?.uri) await persist(video.uri, 'Video');
    } catch (error) {
      errorHaptic();
      say(error instanceof Error ? error.message : 'Recording failed');
    } finally {
      setRecording(false);
      setElapsed(0);
      if (elapsedTimer.current) {
        clearInterval(elapsedTimer.current);
        elapsedTimer.current = null;
      }
    }
  }, [micPermission?.granted, persist, recording, requestMicPermission, say]);

  const stopRecording = useCallback(() => {
    if (!recording) return;
    heavyHaptic();
    cameraRef.current?.stopRecording();
  }, [recording]);

  const runCountdown = useCallback(
    (seconds: number) => {
      setCountdown(seconds);
      countdownTimer.current = setInterval(() => {
        setCountdown((current) => {
          const next = (current ?? 1) - 1;
          if (next > 0) {
            tickHaptic();
            return next;
          }

          if (countdownTimer.current) {
            clearInterval(countdownTimer.current);
            countdownTimer.current = null;
          }
          void takePhoto();
          return null;
        });
      }, 1000);
    },
    [takePhoto],
  );

  const onShutter = useCallback(() => {
    if (!cameraGranted) {
      void requestCameraPermission();
      return;
    }

    if (mode === 'video') {
      if (recording) stopRecording();
      else void startRecording();
      return;
    }

    if (countdown !== null) {
      // A second press cancels a running countdown.
      clearTimers();
      setCountdown(null);
      return;
    }

    if (timerSeconds > 0) {
      runCountdown(timerSeconds);
      return;
    }

    void takePhoto();
  }, [
    cameraGranted,
    clearTimers,
    countdown,
    mode,
    recording,
    requestCameraPermission,
    runCountdown,
    startRecording,
    stopRecording,
    takePhoto,
    timerSeconds,
  ]);

  useEffect(() => {
    return () => {
      clearTimers();
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      // Leaving mid-recording would otherwise strand the file.
      cameraRef.current?.stopRecording();
    };
  }, [clearTimers]);

  // ── Gestures ──────────────────────────────────────────────────────────────

  const swipeStart = useSharedValue(0);
  const swipeDetent = useSharedValue(0);
  const toggleChrome = useCallback(() => setChromeHidden((hidden) => !hidden), []);

  const stageGesture = useMemo(() => {
    const swipe = Gesture.Pan()
      .activeOffsetY([-12, 12])
      .failOffsetX([-24, 24])
      .onBegin(() => {
        swipeStart.value = dial.value;
        swipeDetent.value = Math.round(dial.value * DETENTS);
      })
      .onUpdate((event) => {
        // Up is brighter, matching every exposure slider people already use.
        const next = swipeStart.value - event.translationY / SWIPE_RANGE;
        dial.value = next < 0 ? 0 : next > 1 ? 1 : next;

        const detent = Math.round(dial.value * DETENTS);
        if (detent !== swipeDetent.value) {
          swipeDetent.value = detent;
          runOnJS(tickHaptic)();
        }
      })
      .onFinalize(() => {
        runOnJS(commitIntensity)(dial.value);
      });

    const tap = Gesture.Tap()
      .maxDuration(260)
      // While the permission prompt is showing, the only thing worth tapping in
      // here is that button — swallowing it to hide the chrome would be rude.
      .enabled(cameraGranted)
      .onEnd((_event, success) => {
        if (success) runOnJS(toggleChrome)();
      });

    return Gesture.Exclusive(swipe, tap);
  }, [cameraGranted, commitIntensity, dial, swipeDetent, swipeStart, toggleChrome]);

  // ── Derived styles ────────────────────────────────────────────────────────

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const floodStyle = useAnimatedStyle(() => ({ opacity: floodLevel.value }));

  /**
   * In Max mode the chrome would be white-on-white, so it gets a dark bar
   * behind it. Hiding the chrome (tap the light) drops the scrim with it and
   * leaves the display genuinely edge-to-edge white.
   */
  const scrim = maxMode && lightOn ? 'rgba(0,0,0,0.86)' : 'transparent';

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: withTiming(chromeHidden ? 0 : 1, { duration: 220 }),
  }));

  const onToggleLight = useCallback(() => {
    pressHaptic();
    toggleLight();
  }, [toggleLight]);

  const onFlip = useCallback(() => {
    if (recording) return;
    selectHaptic();
    setCameraFacing((facing) => (facing === 'front' ? 'back' : 'front'));
  }, [recording]);

  const onSelectTemperature = useCallback(
    (id: TemperatureId) => setTemperatureId(id),
    [setTemperatureId],
  );

  const onCycleTimer = useCallback(() => {
    selectHaptic();
    const index = TIMER_CHOICES.indexOf(timerSeconds);
    setTimerSeconds(TIMER_CHOICES[(index + 1) % TIMER_CHOICES.length] ?? 0);
  }, [setTimerSeconds, timerSeconds]);

  const onToggleMax = useCallback(() => {
    pressHaptic();
    toggleMaxMode();
  }, [toggleMaxMode]);

  const onChangeMode = useCallback(
    (next: CameraMode) => {
      if (recording || next === mode) return;
      selectHaptic();
      setMode(next);
    },
    [mode, recording],
  );

  const chromeEvents = chromeHidden ? 'none' : 'auto';

  return (
    <View className="flex-1 bg-ink">
      {/* Max mode's light source: the whole panel, painted behind every other
          layer. The camera window stacks the same black-then-colour pair over
          its own square corners, so they stay invisible at any dial position. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colourCss }, floodStyle]}
      />

      {/* ── Top bar ── */}
      <Animated.View
        style={[chromeStyle, { paddingTop: insets.top, backgroundColor: scrim }]}
        pointerEvents={chromeEvents}
      >
        <View className="h-14 flex-row items-center justify-between px-5">
          <IconButton
            accessibilityLabel="Light settings"
            onPress={() => {
              selectHaptic();
              router.push('/settings');
            }}
          >
            <SlidersIcon colour="#FFFFFF" />
          </IconButton>

          {recording ? (
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <View className="flex-row items-center gap-2 rounded-full bg-black/55 px-3 py-1.5">
                <View className="h-2 w-2 rounded-full bg-[#FF3B30]" />
                <Text
                  className="text-[13px] font-semibold text-white"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {formatDuration(elapsed)}
                </Text>
              </View>
            </Animated.View>
          ) : (
            // ── Brand slot ──────────────────────────────────────────────────
            // Put your app name here when you have one. Uncomment and edit:
            //
            // <Text className="text-[13px] font-medium tracking-[3px] text-white/30">
            //   YOUR NAME
            // </Text>
            //
            // The name also appears in two other places: `expo.name` in
            // app.json (home screen and permission dialogs) and ALBUM_NAME in
            // lib/useMediaSaver.ts (the camera-roll album shots are filed to).
            <View />
          )}

          <IconButton
            accessibilityLabel={lightOn ? 'Turn light off' : 'Turn light on'}
            onPress={onToggleLight}
            active={lightOn}
            accent={ACCENT}
          >
            <BoltIcon colour={lightOn ? '#000000' : '#FFFFFF'} />
          </IconButton>
        </View>
      </Animated.View>

      {/* ── The light ── */}
      <GestureDetector gesture={stageGesture}>
        <View
          className="flex-1 items-center justify-center"
          onLayout={({ nativeEvent }) =>
            setStage({
              width: nativeEvent.layout.width,
              height: nativeEvent.layout.height,
            })
          }
        >
          {stage.width > 0 && (
            <>
              {/* Preview first, ring on top: the mask that squares off the
                  camera must never be painted over the dots. */}
              <CameraWindow
                ref={cameraRef}
                size={windowRadius * 2}
                facing={cameraFacing}
                mirror={mirrorPreview && cameraFacing === 'front'}
                mode={mode}
                zoom={0}
                mute={false}
                active
                granted={cameraGranted}
                maskColour="#000000"
                floodLevel={floodLevel}
                floodColour={colourCss}
                rimColour={maxMode ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.16)'}
                onMountError={say}
              />

              <RingLight
                width={stage.width}
                height={stage.height}
                size={ringSize}
                windowRadius={windowRadius}
                colour={colour}
                ringStyle={ringStyleId}
                output={output}
                active={lightOn}
              />

              {countdown !== null && (
                <Animated.View
                  entering={FadeIn}
                  exiting={FadeOut}
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, styles.centre]}
                >
                  <Text
                    className="text-[76px] font-light"
                    style={{ color: maxMode && lightOn ? '#000000' : '#FFFFFF' }}
                  >
                    {countdown}
                  </Text>
                </Animated.View>
              )}

              {!cameraGranted && (
                <View
                  pointerEvents="box-none"
                  style={[StyleSheet.absoluteFill, styles.centre]}
                >
                  <Pressable
                    onPress={() => void requestCameraPermission()}
                    // Solid dark rather than translucent white: this sits on
                    // the light, which is white in Max mode.
                    className="rounded-full bg-black/75 px-5 py-2.5"
                  >
                    <Text className="text-[13px] font-semibold text-white">
                      Enable camera preview
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}

          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.flash, flashStyle]}
          />

          {notice && (
            <Animated.View
              entering={FadeIn.duration(160)}
              exiting={FadeOut.duration(220)}
              pointerEvents="none"
              style={styles.notice}
            >
              <View className="rounded-full bg-black/70 px-4 py-2">
                <Text className="text-[12px] font-medium text-white/85">{notice}</Text>
              </View>
            </Animated.View>
          )}
        </View>
      </GestureDetector>

      {/* ── Controls ── */}
      <Animated.View
        style={[
          chromeStyle,
          { paddingBottom: Math.max(insets.bottom, 14), backgroundColor: scrim },
        ]}
        pointerEvents={chromeEvents}
      >
        <View className="mb-1 flex-row items-center justify-center gap-2">
          <View className="flex-row rounded-full bg-white/10 p-1">
            <ModeChip
              label="Photo"
              active={mode === 'picture'}
              onPress={() => onChangeMode('picture')}
              icon={
                <PhotoIcon size={14} colour={mode === 'picture' ? '#000000' : '#FFFFFF'} />
              }
            />
            <ModeChip
              label="Video"
              active={mode === 'video'}
              onPress={() => onChangeMode('video')}
              icon={
                <VideoIcon size={14} colour={mode === 'video' ? '#000000' : '#FFFFFF'} />
              }
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Self timer ${timerSeconds} seconds`}
            onPress={onCycleTimer}
            className="flex-row items-center gap-1.5 rounded-full bg-white/10 px-3 py-2"
          >
            <TimerIcon size={14} colour={timerSeconds > 0 ? ACCENT : '#FFFFFF'} />
            <Text
              className="text-[12px] font-semibold"
              style={{ color: timerSeconds > 0 ? ACCENT : 'rgba(255,255,255,0.75)' }}
            >
              {timerSeconds === 0 ? 'Off' : `${timerSeconds}s`}
            </Text>
          </Pressable>

          {/* The brightest mode is the one people reach for most, so it gets a
              chip here rather than living only in Settings. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Maximum brightness, full white screen"
            accessibilityState={{ selected: maxMode }}
            onPress={onToggleMax}
            style={{ backgroundColor: maxMode ? ACCENT : 'rgba(255,255,255,0.10)' }}
            className="flex-row items-center gap-1.5 rounded-full px-3 py-2"
          >
            <SunIcon size={14} colour={maxMode ? '#000000' : '#FFFFFF'} />
            <Text
              className="text-[12px] font-semibold"
              style={{ color: maxMode ? '#000000' : 'rgba(255,255,255,0.75)' }}
            >
              Max
            </Text>
          </Pressable>
        </View>

        <PresetArc
          selected={temperatureId}
          accent={ACCENT}
          onSelect={onSelectTemperature}
          onStep={selectHaptic}
          dimmed={maxMode}
        />

        <LightReadout
          dial={dial}
          // Max mode ignores temperature, so saying otherwise would be a lie.
          detail={maxMode ? 'Max · pure white' : `${temperature.label} ${temperature.kelvin}K`}
          accent={ACCENT}
          lightOn={lightOn}
        />

        <View className="mt-1 flex-row items-center justify-between px-7">
          <LastShot uri={lastShot} />

          <IntensityDial
            size={DIAL_SIZE}
            dial={dial}
            centreRadius={SHUTTER_SIZE / 2}
            accent={ACCENT}
            onCommit={commitIntensity}
            onTick={tickHaptic}
          >
            <ShutterButton
              size={SHUTTER_SIZE}
              recording={recording}
              busy={busy}
              onPress={onShutter}
            />
          </IntensityDial>

          <IconButton
            accessibilityLabel="Switch camera"
            onPress={onFlip}
            disabled={recording}
          >
            <FlipCameraIcon colour="#FFFFFF" />
          </IconButton>
        </View>
      </Animated.View>
    </View>
  );
}

function ModeChip({
  label,
  active,
  icon,
  onPress,
}: {
  label: string;
  active: boolean;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{ backgroundColor: active ? '#FFFFFF' : 'transparent' }}
      className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
    >
      {icon}
      <Text
        className="text-[12px] font-semibold"
        style={{ color: active ? '#000000' : 'rgba(255,255,255,0.7)' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Thumbnail of the most recent capture — confirmation that it really saved. */
function LastShot({ uri }: { uri: string | null }) {
  if (!uri) {
    return <View className="h-11 w-11 rounded-xl border border-white/10" />;
  }

  return (
    <Animated.View entering={FadeIn.duration(240)}>
      <Image
        source={{ uri }}
        accessibilityLabel="Most recent capture"
        contentFit="cover"
        transition={180}
        style={styles.thumbnail}
      />
    </Animated.View>
  );
}

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
};

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
  flash: { backgroundColor: '#FFFFFF' },
  notice: { position: 'absolute', bottom: 8, alignSelf: 'center' },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
});
