import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  DEFAULT_RING_STYLE_ID,
  DEFAULT_TEMPERATURE_ID,
  TEMPERATURES,
  type RingStyleId,
  type TemperatureId,
} from './presets';

export type TimerSeconds = 0 | 3 | 10;

type LightState = {
  /** Master switch. Off means a black screen and the camera preview only. */
  lightOn: boolean;
  /** Dial position, 0–1. Mirrored from the gesture's shared value on release. */
  intensity: number;
  temperatureId: TemperatureId;
  ringStyleId: RingStyleId;
  /** What to fall back to when Max mode is switched off again. */
  previousRingStyleId: RingStyleId;
  /** Flip the preview horizontally so it reads like a mirror. */
  mirrorPreview: boolean;
  /** Drive the hardware backlight from the dial as well as the pixels. */
  syncScreenBrightness: boolean;
  hapticsEnabled: boolean;
  /** Countdown before the shutter fires, so you can put the phone down. */
  timerSeconds: TimerSeconds;

  setLightOn: (on: boolean) => void;
  toggleLight: () => void;
  setIntensity: (value: number) => void;
  setTemperatureId: (id: TemperatureId) => void;
  stepTemperature: (direction: 1 | -1) => void;
  setRingStyleId: (id: RingStyleId) => void;
  /** Jump to full-screen white and back, from the capture screen. */
  toggleMaxMode: () => void;
  setMirrorPreview: (value: boolean) => void;
  setSyncScreenBrightness: (value: boolean) => void;
  setHapticsEnabled: (value: boolean) => void;
  setTimerSeconds: (value: TimerSeconds) => void;
};

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

export const useLightStore = create<LightState>()(
  persist(
    (set, get) => ({
      lightOn: true,
      intensity: 0.72,
      temperatureId: DEFAULT_TEMPERATURE_ID,
      ringStyleId: DEFAULT_RING_STYLE_ID,
      previousRingStyleId: DEFAULT_RING_STYLE_ID,
      mirrorPreview: true,
      syncScreenBrightness: true,
      hapticsEnabled: true,
      timerSeconds: 0,

      setLightOn: (on) => set({ lightOn: on }),
      toggleLight: () => set({ lightOn: !get().lightOn }),
      setIntensity: (value) => set({ intensity: clamp01(value) }),
      setTemperatureId: (id) => set({ temperatureId: id }),
      stepTemperature: (direction) => {
        const current = TEMPERATURES.findIndex((t) => t.id === get().temperatureId);
        const next = Math.min(
          TEMPERATURES.length - 1,
          Math.max(0, (current === -1 ? 2 : current) + direction),
        );
        const target = TEMPERATURES[next];
        if (target) set({ temperatureId: target.id });
      },
      setRingStyleId: (id) =>
        set(
          id === 'screen'
            ? { ringStyleId: id, previousRingStyleId: get().ringStyleId }
            : { ringStyleId: id, previousRingStyleId: id },
        ),
      toggleMaxMode: () => {
        const { ringStyleId, previousRingStyleId } = get();
        set(
          ringStyleId === 'screen'
            ? { ringStyleId: previousRingStyleId }
            : { ringStyleId: 'screen', previousRingStyleId: ringStyleId },
        );
      },
      setMirrorPreview: (value) => set({ mirrorPreview: value }),
      setSyncScreenBrightness: (value) => set({ syncScreenBrightness: value }),
      setHapticsEnabled: (value) => set({ hapticsEnabled: value }),
      setTimerSeconds: (value) => set({ timerSeconds: value }),
    }),
    {
      name: 'halo-light-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persisted, from) => {
        const state = persisted as Partial<LightState>;
        if (from < 2) {
          state.previousRingStyleId = DEFAULT_RING_STYLE_ID;
        }
        // A fallback of 'screen' would make the Max toggle a one-way door.
        if (state.previousRingStyleId === 'screen') {
          state.previousRingStyleId = DEFAULT_RING_STYLE_ID;
        }
        return state as LightState;
      },
      // The light always comes up on, so `lightOn` is deliberately not persisted:
      // opening a ring light app and getting a black screen is a bad first second.
      partialize: ({
        intensity,
        temperatureId,
        ringStyleId,
        previousRingStyleId,
        mirrorPreview,
        syncScreenBrightness,
        hapticsEnabled,
        timerSeconds,
      }) => ({
        intensity,
        temperatureId,
        ringStyleId,
        previousRingStyleId,
        mirrorPreview,
        syncScreenBrightness,
        hapticsEnabled,
        timerSeconds,
      }),
    },
  ),
);
