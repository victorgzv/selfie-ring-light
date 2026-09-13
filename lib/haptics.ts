import * as Haptics from 'expo-haptics';

import { useLightStore } from './store';

/**
 * Thin wrapper over expo-haptics that respects the user's setting and never
 * lets a rejected promise escape. Haptics are best-effort decoration: a device
 * without a taptic engine, or one in a state that refuses feedback, must not
 * take a capture down with it.
 */
const fire = (run: () => Promise<void>): void => {
  if (!useLightStore.getState().hapticsEnabled) return;
  void run().catch(() => {
    /* Feedback is optional; failing silently is correct here. */
  });
};

/** One detent on the intensity dial. Deliberately the lightest tap available. */
export const tickHaptic = (): void => fire(() => Haptics.selectionAsync());

/** Changing temperature preset or ring style. */
export const selectHaptic = (): void =>
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Shutter press and light on/off. */
export const pressHaptic = (): void =>
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** Recording started/stopped — wants to be felt through a pocket. */
export const heavyHaptic = (): void =>
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));

/** A shot landed in the library. */
export const successHaptic = (): void =>
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** Something the user asked for did not happen. */
export const errorHaptic = (): void =>
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
