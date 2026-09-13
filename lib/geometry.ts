/** Pure layout maths for the ring. No React, no side effects, easy to reason about. */

export type Dot = {
  cx: number;
  cy: number;
  /** Dot radius in px. */
  r: number;
};

export type DotRing = {
  /** Distance of this ring's dot centres from the middle of the light. */
  radius: number;
  dots: Dot[];
};

export const TAU = Math.PI * 2;
export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
export const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/** Point on a circle, measured clockwise from 12 o'clock (screen convention). */
export function polar(
  cx: number,
  cy: number,
  radius: number,
  angleDegrees: number,
): { x: number; y: number } {
  const radians = toRadians(angleDegrees - 90);
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

/**
 * Lay out one ring of evenly spaced dots.
 *
 * The count is derived from circumference rather than hard-coded so every ring
 * keeps the same visual dot *density* — otherwise the outer rings read as
 * sparse and the light looks broken rather than beaded.
 */
export function buildDotRing(
  centre: number,
  radius: number,
  dotRadius: number,
  gap: number,
): DotRing {
  const step = dotRadius * 2 + gap;
  const count = Math.max(8, Math.round((TAU * radius) / step));
  const dots: Dot[] = [];

  for (let i = 0; i < count; i += 1) {
    const { x, y } = polar(centre, centre, radius, (i / count) * 360);
    dots.push({ cx: x, cy: y, r: dotRadius });
  }

  return { radius, dots };
}

/**
 * The three concentric dot rings that make up the signature look, sized
 * relative to the camera window so the whole thing scales with the screen.
 */
export function buildDotField(canvasSize: number, windowRadius: number): DotRing[] {
  const centre = canvasSize / 2;
  const outer = canvasSize / 2;
  /** Space between the camera window edge and the outermost dots. */
  const band = outer - windowRadius;

  // Fat dots with tight gaps. The dot field lights only a few percent of the
  // panel, so its brightness is almost entirely a question of how much of the
  // ring band is actually covered in pixels — thin dots look elegant and put
  // out very little light.
  return [
    buildDotRing(centre, windowRadius + band * 0.25, band * 0.095, band * 0.055),
    buildDotRing(centre, windowRadius + band * 0.54, band * 0.083, band * 0.062),
    buildDotRing(centre, windowRadius + band * 0.81, band * 0.07, band * 0.07),
  ];
}

/**
 * Shortest signed distance from `from` to `to` in degrees, in (-180, 180].
 * Keeps the rotary dial from spinning the long way round when the finger
 * crosses the 12 o'clock seam.
 */
export function shortestAngleDelta(from: number, to: number): number {
  'worklet';
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta <= -180) delta += 360;
  return delta;
}

/** Angle in degrees from a circle's centre to a point, clockwise from 12 o'clock. */
export function angleFromCentre(centre: number, x: number, y: number): number {
  'worklet';
  // Inlined rather than calling a shared helper: this runs inside a gesture
  // worklet, and keeping it self-contained avoids depending on how the worklet
  // plugin resolves cross-function references.
  const angle = (Math.atan2(y - centre, x - centre) * 180) / Math.PI + 90;
  return (angle + 360) % 360;
}

/**
 * An arc of a circle as an SVG path, angles measured clockwise from 12 o'clock.
 * Used for anything that must not run the full way round — the dial's live
 * track stops short so the bottom gap stays empty.
 */
export function arcPath(
  centre: number,
  radius: number,
  startDegrees: number,
  sweepDegrees: number,
): string {
  const start = polar(centre, centre, radius, startDegrees);
  const end = polar(centre, centre, radius, startDegrees + sweepDegrees);
  const largeArc = Math.abs(sweepDegrees) > 180 ? 1 : 0;
  const clockwise = sweepDegrees >= 0 ? 1 : 0;

  return `M${start.x.toFixed(2)},${start.y.toFixed(2)} A${radius.toFixed(2)},${radius.toFixed(2)} 0 ${largeArc},${clockwise} ${end.x.toFixed(2)},${end.y.toFixed(2)}`;
}

/**
 * Collapse a ring of dots into one SVG path with many sub-paths.
 *
 * Two arcs per dot draw a full circle. Doing it this way means each ring is a
 * single `<Path>` node instead of ~70 `<Circle>` nodes — the dot field drops
 * from a couple of hundred views to three, which is the difference between a
 * ring that animates at 60fps and one that does not.
 */
export function dotsToPath(dots: Dot[]): string {
  let d = '';
  for (const { cx, cy, r } of dots) {
    d += `M${(cx - r).toFixed(2)},${cy.toFixed(2)}`;
    d += `a${r.toFixed(2)},${r.toFixed(2)} 0 1,0 ${(r * 2).toFixed(2)},0`;
    d += `a${r.toFixed(2)},${r.toFixed(2)} 0 1,0 ${(-r * 2).toFixed(2)},0`;
  }
  return d;
}
