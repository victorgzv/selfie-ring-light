import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Hand-drawn 24×24 stroke icons.
 *
 * Small enough that pulling in an icon font or library would cost more than it
 * saves, and inline paths keep the whole set tintable from one `colour` prop.
 */
export type IconProps = {
  size?: number;
  colour?: string;
  /** Stroke weight, in viewBox units. */
  weight?: number;
};

type Internal = Required<IconProps>;

const withDefaults = ({ size = 22, colour = '#FFFFFF', weight = 1.8 }: IconProps): Internal => ({
  size,
  colour,
  weight,
});

export function BoltIcon(props: IconProps) {
  const { size, colour } = withDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M13 2 L4.5 13.5 H11 L10 22 L19.5 10.5 H13 Z" fill={colour} />
    </Svg>
  );
}

export function SlidersIcon(props: IconProps) {
  const { size, colour, weight } = withDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 8 H20" stroke={colour} strokeWidth={weight} strokeLinecap="round" />
      <Path d="M3 16 H20" stroke={colour} strokeWidth={weight} strokeLinecap="round" />
      <Circle cx={9} cy={8} r={2.6} stroke={colour} strokeWidth={weight} fill="#000000" />
      <Circle cx={15} cy={16} r={2.6} stroke={colour} strokeWidth={weight} fill="#000000" />
    </Svg>
  );
}

export function FlipCameraIcon(props: IconProps) {
  const { size, colour, weight } = withDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 12 A8 8 0 0 1 17.4 6.1"
        stroke={colour}
        strokeWidth={weight}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M20 12 A8 8 0 0 1 6.6 17.9"
        stroke={colour}
        strokeWidth={weight}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M13.6 6.1 H17.6 V2.4"
        stroke={colour}
        strokeWidth={weight}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.4 17.9 H6.4 V21.6"
        stroke={colour}
        strokeWidth={weight}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TimerIcon(props: IconProps) {
  const { size, colour, weight } = withDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={13.5} r={7.8} stroke={colour} strokeWidth={weight} fill="none" />
      <Path
        d="M12 9.5 V13.5 H15"
        stroke={colour}
        strokeWidth={weight}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9.5 2.4 H14.5" stroke={colour} strokeWidth={weight} strokeLinecap="round" />
    </Svg>
  );
}

export function PhotoIcon(props: IconProps) {
  const { size, colour, weight } = withDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3.6 8.4 A1.8 1.8 0 0 1 5.4 6.6 H8 L9.4 4.4 H14.6 L16 6.6 H18.6 A1.8 1.8 0 0 1 20.4 8.4 V17.8 A1.8 1.8 0 0 1 18.6 19.6 H5.4 A1.8 1.8 0 0 1 3.6 17.8 Z"
        stroke={colour}
        strokeWidth={weight}
        fill="none"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={3.6} stroke={colour} strokeWidth={weight} fill="none" />
    </Svg>
  );
}

export function VideoIcon(props: IconProps) {
  const { size, colour, weight } = withDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2.8 8 A2 2 0 0 1 4.8 6 H13.2 A2 2 0 0 1 15.2 8 V16 A2 2 0 0 1 13.2 18 H4.8 A2 2 0 0 1 2.8 16 Z"
        stroke={colour}
        strokeWidth={weight}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M15.2 10.8 L21.2 7.2 V16.8 L15.2 13.2 Z"
        stroke={colour}
        strokeWidth={weight}
        fill="none"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  const { size, colour, weight } = withDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 6 L18 18" stroke={colour} strokeWidth={weight} strokeLinecap="round" />
      <Path d="M18 6 L6 18" stroke={colour} strokeWidth={weight} strokeLinecap="round" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  const { size, colour, weight } = withDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4.8 12.6 L9.6 17.4 L19.2 6.6"
        stroke={colour}
        strokeWidth={weight}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SunIcon(props: IconProps) {
  const { size, colour, weight } = withDefaults(props);
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={4.4} stroke={colour} strokeWidth={weight} fill="none" />
      {rays.map((degrees) => {
        const radians = (degrees * Math.PI) / 180;
        const x1 = 12 + Math.cos(radians) * 7.2;
        const y1 = 12 + Math.sin(radians) * 7.2;
        const x2 = 12 + Math.cos(radians) * 9.6;
        const y2 = 12 + Math.sin(radians) * 9.6;
        return (
          <Path
            key={degrees}
            d={`M${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}`}
            stroke={colour}
            strokeWidth={weight}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}
