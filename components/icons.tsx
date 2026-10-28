import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const SearchIcon = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Svg>;
export const CloseIcon = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const DirectionsIcon = (p: P) => <Svg {...p}><path d="M12 2.8 21.2 12 12 21.2 2.8 12z" /><path d="M9.5 14v-2.5a1.5 1.5 0 0 1 1.5-1.5h4" /><path d="m13 8 2 2-2 2" /></Svg>;
export const SwapIcon = (p: P) => <Svg {...p}><path d="M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3" /></Svg>;
export const CarIcon = (p: P) => <Svg {...p}><path d="M5 16V11.5l2-5h10l2 5V16" /><path d="M3.5 16h17v2.5h-17z" /><circle cx="7.5" cy="13" r=".6" fill="currentColor" /><circle cx="16.5" cy="13" r=".6" fill="currentColor" /></Svg>;
export const PlayIcon = (p: P) => <Svg {...p}><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></Svg>;
export const PauseIcon = (p: P) => <Svg {...p}><path d="M8 5v14M16 5v14" strokeWidth="3" /></Svg>;
export const LayersIcon = (p: P) => <Svg {...p}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></Svg>;
export const CubeIcon = (p: P) => <Svg {...p}><path d="m12 2.8 8 4.6v9.2l-8 4.6-8-4.6V7.4z" /><path d="m4 7.4 8 4.6 8-4.6M12 12v9.2" /></Svg>;
export const LocateIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="3.2" /><circle cx="12" cy="12" r="7.5" /><path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3" /></Svg>;
export const SunIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></Svg>;
export const MoonIcon = (p: P) => <Svg {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></Svg>;
export const PlusIcon = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const MinusIcon = (p: P) => <Svg {...p}><path d="M5 12h14" /></Svg>;
export const PinIcon = (p: P) => <Svg {...p}><path d="M12 21.5s-7-6.2-7-11.7a7 7 0 0 1 14 0c0 5.5-7 11.7-7 11.7z" /><circle cx="12" cy="9.8" r="2.4" /></Svg>;
export const BuildingIcon = (p: P) => <Svg {...p}><path d="M5 21V4.5L13 3v18M13 8.5l6 1.8V21M3 21h18" /><path d="M8 7.5h2M8 11h2M8 14.5h2M16 13h.5M16 16.5h.5" /></Svg>;
export const TempleIcon = (p: P) => <Svg {...p}><path d="M12 2.5v3M10 8.5 12 5.5l2 3M8 13l4-4.5 4 4.5M5 21v-4l7-4 7 4v4M3 21h18" /></Svg>;
export const MountainIcon = (p: P) => <Svg {...p}><path d="m2.5 19.5 7-11 4.5 7 2.5-3.5 5 7.5z" /><path d="m7.6 11.5 2 1.5 1.8-1.4" /></Svg>;
export const GlobeIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Svg>;
export const CityIcon = (p: P) => <Svg {...p}><path d="M3 21V10l5-3v14M8 21V4h7v17M15 21v-9l6 2v7M2 21h20" /><path d="M11 7.5h1M11 11h1M11 14.5h1" /></Svg>;
export const TowerIcon = (p: P) => <Svg {...p}><path d="M9 21V6l3-3.5L15 6v15M7 21h10M12 6v15" /><path d="M9 10h6M9 14h6" /></Svg>;
export const OrbitIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="2.6" /><path d="M20.5 12c0 2.5-3.8 4.5-8.5 4.5S3.5 14.5 3.5 12 7.3 7.5 12 7.5c2.3 0 4.4.5 5.9 1.3" /><path d="m17 6.4 1.9 2.4-2.6 1.3" /></Svg>;
export const ChevronIcon = (p: P) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const SparkIcon = (p: P) => <Svg {...p}><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z" /></Svg>;

// Turn arrow for a manoeuvre (OSRM type + modifier).
const TURN_ANGLE: Record<string, number> = {
  straight: 0, 'slight right': 40, right: 90, 'sharp right': 135, uturn: 180,
  'sharp left': -135, left: -90, 'slight left': -40,
};

export function ManeuverIcon({ type, modifier, ...p }: P & { type: string; modifier?: string }) {
  if (type === 'arrive') {
    return <Svg {...p}><path d="M6 21V4M6 4.5h11l-2.5 4 2.5 4H6" /></Svg>;
  }
  if (type.includes('roundabout') || type.includes('rotary')) {
    return <Svg {...p}><circle cx="12" cy="10" r="4" /><path d="M12 21v-7M16 10h4.5M18.5 8l2 2-2 2" /></Svg>;
  }
  if (modifier === 'uturn') {
    return <Svg {...p}><path d="M8 21V10a4 4 0 0 1 8 0v5" /><path d="m13 12.5 3 3 3-3" /></Svg>;
  }
  const angle = TURN_ANGLE[modifier ?? 'straight'] ?? 0;
  // A road coming from below that bends towards `angle`.
  const r = (angle * Math.PI) / 180;
  const ex = 12 + Math.sin(r) * 7;
  const ey = 10 - Math.cos(r) * 7;
  const head = (a: number) => `${ex + Math.sin(r + a) * -4},${ey - Math.cos(r + a) * -4}`;
  return (
    <Svg {...p}>
      <path d={`M12 21v-8 Q12 10 ${ex} ${ey}`} />
      <path d={`M${head(0.6)} L${ex},${ey} L${head(-0.6)}`} />
    </Svg>
  );
}

export const GamepadIcon = (p: P) => <Svg {...p}><path d="M7 8h10a4.5 4.5 0 0 1 4.4 5.5l-.8 3.6a2.4 2.4 0 0 1-4.2 1L14.6 16H9.4l-1.8 2.1a2.4 2.4 0 0 1-4.2-1l-.8-3.6A4.5 4.5 0 0 1 7 8z" /><path d="M7.5 11v3M6 12.5h3" /><circle cx="16" cy="11.6" r=".7" fill="currentColor" /><circle cx="17.6" cy="13.4" r=".7" fill="currentColor" /></Svg>;
export const SoundIcon = (p: P) => <Svg {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></Svg>;
export const MuteIcon = (p: P) => <Svg {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></Svg>;
export const ResetIcon = (p: P) => <Svg {...p}><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4.5h4.5" /></Svg>;
export const BoltIcon = (p: P) => <Svg {...p}><path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" /></Svg>;
