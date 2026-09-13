/**
 * Assertions over the pure light maths — the parts that decide whether the
 * lamp is physically sensible and whether the dot field actually clears the
 * camera window. None of it touches React Native, so it runs in plain node:
 *
 *   npm test
 *
 * The UI on top of these functions needs a device; this is the half that can
 * be checked before you get there.
 */
import {
  dialToOutput,
  kelvinToRgb,
  luminance,
  rgbToCss,
  ringLayerLevel,
  scaleRgb,
} from '../lib/colour.ts';
import {
  angleFromCentre,
  arcPath,
  buildDotField,
  dotsToPath,
  polar,
  shortestAngleDelta,
} from '../lib/geometry.ts';

let failures = 0;

const check = (name: string, condition: boolean, detail = ''): void => {
  if (condition) {
    console.log(`  ok    ${name}${detail ? '  ' + detail : ''}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? '  ' + detail : ''}`);
  }
};

console.log('\nKelvin -> sRGB along the Planckian locus');
for (const k of [1900, 2700, 3400, 4300, 5600, 6500, 8000]) {
  const c = kelvinToRgb(k);
  console.log(
    `   ${String(k).padStart(5)}K  ${rgbToCss(c).padEnd(22)} luminance ${luminance(c).toFixed(3)}`,
  );
}
const warm = kelvinToRgb(2700);
const cool = kelvinToRgb(8000);
const neutral = kelvinToRgb(6500);
check('warm light is red-dominant', warm.r > warm.g && warm.g > warm.b);
check('cool light is blue-dominant', cool.b >= cool.r && cool.b > 200);
check(
  '6500K lands near white',
  Math.abs(neutral.r - 255) < 30 && Math.abs(neutral.b - 255) < 40,
  rgbToCss(neutral),
);
check(
  'channels stay integral and in gamut at any input',
  [1000, 2000, 4000, 6000, 12000, 40000, 100, -5, 1e9].every((k) => {
    const c = kelvinToRgb(k);
    return [c.r, c.g, c.b].every((v) => Number.isInteger(v) && v >= 0 && v <= 255);
  }),
);
check(
  'scaling a colour keeps it in gamut',
  [0, 0.3, 1, 4].every((f) => {
    const c = scaleRgb(kelvinToRgb(3400), f);
    return [c.r, c.g, c.b].every((v) => v >= 0 && v <= 255);
  }),
);

console.log('\nIntensity curve and per-ring levels');
for (const d of [0, 0.18, 0.35, 0.5, 0.72, 0.9, 1]) {
  const o = dialToOutput(d);
  const rings = [0, 1, 2].map((i) => ringLayerLevel(o, i).toFixed(2)).join(' / ');
  console.log(`   dial ${d.toFixed(2)} -> output ${o.toFixed(3)}   rings ${rings}`);
}
const sweep = Array.from({ length: 101 }, (_, i) => i / 100);
check('curve is clamped at both ends', dialToOutput(-1) === dialToOutput(0) && dialToOutput(2) === dialToOutput(1));
check(
  'curve rises monotonically',
  sweep.every((d, i) => i === 0 || dialToOutput(d) > dialToOutput(sweep[i - 1]!)),
);
check(
  'the floor keeps the ring lit at zero',
  dialToOutput(0) >= 0.05 && dialToOutput(0) <= 0.15,
  `-> ${dialToOutput(0).toFixed(3)}`,
);
check('a full dial is full output', Math.abs(dialToOutput(1) - 1) < 1e-9);
check(
  'the curve is perceptual, not linear',
  dialToOutput(0.5) < 0.5,
  `midpoint -> ${dialToOutput(0.5).toFixed(3)}`,
);
check(
  'inner rings are never dimmer than outer ones',
  sweep.every((d) => {
    const o = dialToOutput(d);
    return ringLayerLevel(o, 0) >= ringLayerLevel(o, 1) && ringLayerLevel(o, 1) >= ringLayerLevel(o, 2);
  }),
);
check(
  'every ring reaches full at the top of the dial',
  [0, 1, 2].every((i) => Math.abs(ringLayerLevel(1, i) - 1) < 1e-9),
);
check(
  'ring levels stay within 0..1 across the sweep',
  sweep.every((d) => [0, 1, 2].every((i) => {
    const v = ringLayerLevel(dialToOutput(d), i);
    return v >= 0 && v <= 1;
  })),
);

console.log('\nDot field geometry (346px canvas, 102px window — the phone-sized case)');
const CANVAS = 346;
const WINDOW = 346 * 0.295;
const CENTRE = CANVAS / 2;
const field = buildDotField(CANVAS, WINDOW);
check('three concentric rings', field.length === 3);
for (const [i, ring] of field.entries()) {
  console.log(
    `   ring ${i}: radius ${ring.radius.toFixed(1)}  dots ${ring.dots.length}  dot r ${ring.dots[0]!.r.toFixed(2)}`,
  );
}
check(
  'rings increase in radius',
  field[0]!.radius < field[1]!.radius && field[1]!.radius < field[2]!.radius,
);
check(
  'no dot overlaps the camera window',
  field.every((r) => r.dots.every((d) => Math.hypot(d.cx - CENTRE, d.cy - CENTRE) - d.r > WINDOW)),
);
check(
  'no dot escapes the canvas',
  field.every((r) =>
    r.dots.every(
      (d) =>
        d.cx - d.r >= -0.01 &&
        d.cx + d.r <= CANVAS + 0.01 &&
        d.cy - d.r >= -0.01 &&
        d.cy + d.r <= CANVAS + 0.01,
    ),
  ),
);
check(
  'rings do not collide with each other',
  field.every((ring, i) => {
    const next = field[i + 1];
    if (!next) return true;
    return next.radius - next.dots[0]!.r > ring.radius + ring.dots[0]!.r;
  }),
);
check(
  'dot spacing is even across rings',
  field.every((r) => {
    const spacing = (2 * Math.PI * r.radius) / r.dots.length;
    return spacing > 8 && spacing < 16;
  }),
);
const path = dotsToPath(field[0]!.dots);
check('the path emits two arcs per dot', (path.match(/a/g) ?? []).length === field[0]!.dots.length * 2);
check('the path emits one move per dot', (path.match(/M/g) ?? []).length === field[0]!.dots.length);

console.log('\nDial angle maths');
check("12 o'clock reads 0deg", Math.abs(angleFromCentre(50, 50, 0)) < 1e-9);
check("3 o'clock reads 90deg", Math.abs(angleFromCentre(50, 100, 50) - 90) < 1e-9);
check("6 o'clock reads 180deg", Math.abs(angleFromCentre(50, 50, 100) - 180) < 1e-9);
check("9 o'clock reads 270deg", Math.abs(angleFromCentre(50, 0, 50) - 270) < 1e-9);
check('delta takes the short way over the seam', shortestAngleDelta(350, 10) === 20);
check('delta is signed the other way too', shortestAngleDelta(10, 350) === -20);
check(
  'delta never exceeds half a turn',
  Array.from({ length: 720 }, (_, i) => Math.abs(shortestAngleDelta(i % 360, (i * 7) % 360))).every(
    (v) => v <= 180,
  ),
);
check(
  'polar round-trips through angleFromCentre',
  [0, 37, 90, 180, 271, 359].every((a) => {
    const p = polar(50, 50, 40, a);
    return Math.abs(shortestAngleDelta(a, angleFromCentre(50, p.x, p.y))) < 1e-9;
  }),
);

console.log('\nArc path');
check('a 270deg arc sets the large-arc flag', / 1,1 /.test(arcPath(74, 61, 225, 270)));
check('a 90deg arc does not', / 0,1 /.test(arcPath(74, 61, 0, 90)));
check('a negative sweep flips the direction flag', / 0,0 /.test(arcPath(74, 61, 0, -90)));

if (failures === 0) {
  console.log('\nAll checks passed.\n');
} else {
  console.log(`\n${failures} check(s) failed.\n`);
  process.exitCode = 1;
}
