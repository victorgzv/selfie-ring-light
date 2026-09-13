/**
 * Colour maths for the light engine.
 *
 * The screen is the lamp, so the pixels we paint *are* the light output. That
 * makes it worth getting the colour right rather than just fading white to
 * grey: a 2700 K key light and a 6500 K key light are genuinely different
 * tools, and skin renders badly under a wrong one.
 */

export type Rgb = { r: number; g: number; b: number };

const clamp255 = (value: number): number =>
  value < 0 ? 0 : value > 255 ? 255 : Math.round(value);

/**
 * Correlated colour temperature -> sRGB, using Tanner Helland's piecewise fit
 * of the Planckian locus. Accurate to a few units across 1000–40000 K, which
 * is far tighter than the eye can resolve on a phone panel.
 */
export function kelvinToRgb(kelvin: number): Rgb {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;

  let r: number;
  let g: number;
  let b: number;

  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }

  if (t >= 66) {
    b = 255;
  } else if (t <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  }

  return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
}

export const rgbToCss = ({ r, g, b }: Rgb): string => `rgb(${r}, ${g}, ${b})`;

export const rgbaToCss = ({ r, g, b }: Rgb, alpha: number): string =>
  `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha)).toFixed(3)})`;

/**
 * Scale a colour's brightness while keeping its hue. Simple linear scaling in
 * sRGB is the right move here: we want the *emitted* value to track the dial,
 * and the panel already applies its own gamma.
 */
export const scaleRgb = ({ r, g, b }: Rgb, factor: number): Rgb => ({
  r: clamp255(r * factor),
  g: clamp255(g * factor),
  b: clamp255(b * factor),
});

/**
 * Relative luminance (Rec. 709). Used to pick legible foreground text when the
 * flood fills the whole screen with an arbitrary temperature.
 */
export const luminance = ({ r, g, b }: Rgb): number =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Emitted light at a dial of zero. The master switch is what turns the lamp
 *  off; the bottom of the dial is a low setting, not darkness. */
const OUTPUT_FLOOR = 0.1;
/** Perceptual exponent. Above ~2 the bottom half of the travel goes dead. */
const OUTPUT_GAMMA = 1.85;

/**
 * Maps the 0–1 dial position to an emitted-light factor.
 *
 * A linear map feels wrong on a lamp: perceived brightness follows roughly a
 * power law, so a linear dial dumps most of its useful travel into the top
 * third. The exponent spreads the steps out evenly, and the floor keeps the
 * ring usable at the bottom of the range instead of snapping to black.
 */
export const dialToOutput = (dial: number): number => {
  'worklet';
  const t = dial < 0 ? 0 : dial > 1 ? 1 : dial;
  return OUTPUT_FLOOR + (1 - OUTPUT_FLOOR) * Math.pow(t, OUTPUT_GAMMA);
};

/**
 * How lit a given dot ring is, given the overall output.
 *
 * Rings switch on from the inside out: at low output only the inner ring
 * glows, and the light grows outward as the dial climbs, which is how a real
 * dimmable ring behaves. Each ring is normalised against its own remaining
 * range so they all arrive at full together at the top of the dial.
 */
export const ringLayerLevel = (output: number, index: number): number => {
  'worklet';
  const threshold = index * 0.1;
  const level = (output - threshold) / (1 - threshold);
  return level < 0 ? 0 : level > 1 ? 1 : level;
};
