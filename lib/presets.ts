import { kelvinToRgb, type Rgb } from './colour';

/** A named point on the Planckian locus, chosen to match real lighting kit. */
export type Temperature = {
  id: TemperatureId;
  /** Shown on the curved dial track. Kept short so it fits on the arc. */
  label: string;
  kelvin: number;
  /** One line of "when would I reach for this", shown in Settings. */
  hint: string;
};

export type TemperatureId =
  | 'candle'
  | 'tungsten'
  | 'warm'
  | 'neutral'
  | 'daylight'
  | 'cloudy'
  | 'shade';

export const TEMPERATURES: readonly Temperature[] = [
  { id: 'candle', label: 'Candle', kelvin: 1900, hint: 'Deep amber. Evening mood, heavy warmth.' },
  { id: 'tungsten', label: 'Tungsten', kelvin: 2700, hint: 'Classic bulb. Flatters skin indoors at night.' },
  { id: 'warm', label: 'Warm', kelvin: 3400, hint: 'Soft golden key. The safe default for selfies.' },
  { id: 'neutral', label: 'Neutral', kelvin: 4300, hint: 'True-to-life colour. Good for makeup and detail.' },
  { id: 'daylight', label: 'Daylight', kelvin: 5600, hint: 'Studio standard. Matches window light.' },
  { id: 'cloudy', label: 'Cloudy', kelvin: 6500, hint: 'Crisp and bright. Cuts through warm rooms.' },
  { id: 'shade', label: 'Shade', kelvin: 8000, hint: 'Cool blue. Editorial, high-contrast look.' },
] as const;

export const DEFAULT_TEMPERATURE_ID: TemperatureId = 'warm';

export const temperatureById = (id: TemperatureId): Temperature =>
  TEMPERATURES.find((t) => t.id === id) ?? TEMPERATURES[2]!;

export const temperatureIndex = (id: TemperatureId): number => {
  const index = TEMPERATURES.findIndex((t) => t.id === id);
  return index === -1 ? 2 : index;
};

export const rgbForTemperature = (id: TemperatureId): Rgb =>
  kelvinToRgb(temperatureById(id).kelvin);

/**
 * How the emitted light is shaped on screen. Every style lights the subject;
 * they differ in the catchlight they leave in the eyes, which is the part
 * people actually notice in the final shot.
 */
export type RingStyleId = 'dots' | 'halo' | 'beauty' | 'flood' | 'screen';

export type RingStyle = {
  id: RingStyleId;
  label: string;
  hint: string;
};

export const RING_STYLES: readonly RingStyle[] = [
  { id: 'dots', label: 'Dots', hint: 'Three counter-rotating rings of points. Beaded catchlight.' },
  { id: 'halo', label: 'Halo', hint: 'One continuous soft ring. Clean circular catchlight.' },
  { id: 'beauty', label: 'Beauty', hint: 'Wide feathered ring. Softest shadows of the ring styles.' },
  { id: 'flood', label: 'Flood', hint: 'The area around the preview lit in your chosen temperature.' },
  {
    id: 'screen',
    label: 'Max',
    hint: 'Every pixel white, edge to edge, bar the preview. Ignores colour temperature — this is the most light the phone can physically make.',
  },
] as const;

/** Ring styles whose output is limited by how little of the panel they light. */
export const isFullScreenStyle = (id: RingStyleId): boolean => id === 'screen';

/** Pure white. Used by Max, which trades tint for the last of the output. */
export const MAX_MODE_COLOUR = { r: 255, g: 255, b: 255 } as const;

export const DEFAULT_RING_STYLE_ID: RingStyleId = 'dots';

export const ringStyleById = (id: RingStyleId): RingStyle =>
  RING_STYLES.find((s) => s.id === id) ?? RING_STYLES[0]!;
