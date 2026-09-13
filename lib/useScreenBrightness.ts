import * as Brightness from 'expo-brightness';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

/**
 * Drives the hardware backlight.
 *
 * The panel is the lamp, so the backlight is the single biggest lever on how
 * much light actually reaches a face — far bigger than anything we paint. The
 * rules this hook enforces:
 *
 *  - Remember the brightness we found, and always hand it back. Leaving
 *    someone's phone pinned at 100% after they close the app is rude and
 *    drains the battery.
 *  - Restore on background too, so the level does not leak into other apps.
 *  - Throttle writes. `setBrightnessAsync` crosses the bridge and hits the
 *    window manager on the UI thread; calling it on every frame of a drag
 *    makes the gesture stutter.
 *
 * `restoreSystemBrightnessAsync` only exists on Android — on iOS the module
 * has no such function and calling it throws — so iOS restores by writing the
 * captured value back.
 */
const WRITE_INTERVAL_MS = 90;

export function useScreenBrightness(): {
  apply: (value: number) => void;
  restore: () => void;
} {
  const originalRef = useRef<number | null>(null);
  const targetRef = useRef<number | null>(null);
  const lastWriteRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Null until we have actually taken control, so we never restore blindly. */
  const engagedRef = useRef(false);

  const write = useCallback(async (value: number) => {
    try {
      if (originalRef.current === null) {
        originalRef.current = await Brightness.getBrightnessAsync();
      }
      engagedRef.current = true;
      await Brightness.setBrightnessAsync(Math.min(1, Math.max(0, value)));
    } catch {
      /* Some devices and simulators refuse brightness control. The light still
         works, just capped by whatever the user has set manually. */
    }
  }, []);

  /** Hand the backlight back to the OS but remember where we want it. */
  const release = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!engagedRef.current) return;
    engagedRef.current = false;

    void (async () => {
      try {
        if (Platform.OS === 'android') {
          await Brightness.restoreSystemBrightnessAsync();
        } else if (originalRef.current !== null) {
          await Brightness.setBrightnessAsync(originalRef.current);
        }
      } catch {
        /* Nothing useful to do if the OS will not give the level back. */
      }
    })();
  }, []);

  /**
   * Give the backlight back for good. Clearing the target matters: without it,
   * switching the light off and then backgrounding and reopening the app would
   * silently re-apply the old level.
   */
  const restore = useCallback(() => {
    targetRef.current = null;
    release();
  }, [release]);

  const apply = useCallback(
    (value: number) => {
      targetRef.current = value;

      const now = Date.now();
      const elapsed = now - lastWriteRef.current;

      if (elapsed >= WRITE_INTERVAL_MS) {
        lastWriteRef.current = now;
        void write(value);
        return;
      }

      // Trailing edge: guarantees the final position of a drag is written even
      // though we dropped the frames in between.
      if (timerRef.current) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        lastWriteRef.current = Date.now();
        if (targetRef.current !== null) void write(targetRef.current);
      }, WRITE_INTERVAL_MS - elapsed);
    },
    [write],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        if (targetRef.current !== null) void write(targetRef.current);
      } else {
        release();
      }
    });

    return () => {
      subscription.remove();
      restore();
    };
  }, [release, restore, write]);

  return { apply, restore };
}
