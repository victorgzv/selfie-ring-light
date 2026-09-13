import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useLightStore } from './store';

/**
 * Haptic feedback, routed to whichever API the platform actually feels.
 *
 * iOS gets the `UIFeedbackGenerator` family, which is what those calls map to
 * natively and is exactly right for this UI.
 *
 * Android must not use them. There, `selectionAsync` and `impactAsync('light')`
 * drive the raw vibrator at amplitude 30 out of 255 for 50ms — far too faint to
 * notice on most phones, which makes the dial feel like it has no detents at
 * all. `performAndroidHapticsAsync` instead goes through
 * `View.performHapticFeedback` with the platform's own constants, so the OEM
 * decides what a "tick" feels like and it lands like every other Android
 * control. expo-haptics' own source recommends this.
 *
 * Note that the Android path respects the system's touch-feedback setting: if
 * the user has haptics off system-wide, nothing fires. That is correct, and it
 * is also the first thing to check when someone reports no feedback.
 */
const ANDROID = Platform.OS === 'android';

const run = (job: () => Promise<unknown>): void => {
  if (!useLightStore.getState().hapticsEnabled) return;
  void job().catch(() => {
    /* Feedback is decoration. It must never take a capture down with it. */
  });
};

/** One detent on the intensity dial. */
export const tickHaptic = (): void =>
  run(() =>
    ANDROID
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick)
      : Haptics.selectionAsync(),
  );

/** Changing temperature preset, ring style, or a chip. */
export const selectHaptic = (): void =>
  run(() =>
    ANDROID
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  );

/** Shutter press and light on/off. */
export const pressHaptic = (): void =>
  run(() =>
    ANDROID
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  );

/** Recording started or stopped — wants to be felt through a pocket. */
export const heavyHaptic = (): void =>
  run(() =>
    ANDROID
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  );

/** A shot landed in the library. */
export const successHaptic = (): void =>
  run(() =>
    ANDROID
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );

/** Something the user asked for did not happen. */
export const errorHaptic = (): void =>
  run(() =>
    ANDROID
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  );

/**
 * Fires a short burst and reports what happened, for the Settings diagnostic.
 *
 * Unlike the helpers above this does not swallow errors, because the whole
 * point is to tell the user whether the silence is the app, the setting, or
 * the device.
 */
export async function testHaptics(): Promise<string> {
  if (!useLightStore.getState().hapticsEnabled) {
    return 'Haptics are switched off — turn them on above.';
  }

  try {
    pressHaptic();
    await new Promise((resolve) => setTimeout(resolve, 140));
    tickHaptic();
    await new Promise((resolve) => setTimeout(resolve, 140));
    successHaptic();
  } catch (error) {
    return error instanceof Error ? error.message : 'The device refused haptics.';
  }

  return ANDROID
    ? 'Sent. Nothing? Check Settings → Sound & vibration → touch feedback.'
    : 'Sent. Nothing? Check Settings → Sounds & Haptics, and Low Power Mode.';
}
