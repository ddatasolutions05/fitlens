import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { useTheme } from './theme';

export type IconName =
  | 'home'
  | 'dumbbell'
  | 'barcode'
  | 'today'
  | 'diary'
  | 'progress'
  | 'coach'
  | 'profile'
  | 'plus'
  | 'camera'
  | 'search'
  | 'pencil'
  | 'water'
  | 'scale'
  | 'activity'
  | 'chevronLeft'
  | 'chevronRight'
  | 'check'
  | 'close'
  | 'send'
  | 'star'
  | 'starFilled'
  | 'flame'
  | 'bolt'
  | 'trend';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Single-weight stroke icons on a 24 unit grid. Colour defaults to the text colour. */
export function Icon({ name, size = 22, color, strokeWidth = 1.8 }: IconProps) {
  const { colors } = useTheme();
  const stroke = color ?? colors.text;
  const common = { stroke, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'barcode' ? (
        <>
          <Path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3" {...common} />
          <Line x1={7} y1={8} x2={7} y2={16} {...common} />
          <Line x1={10} y1={8} x2={10} y2={16} {...common} />
          <Line x1={13.5} y1={8} x2={13.5} y2={16} {...common} />
          <Line x1={17} y1={8} x2={17} y2={16} {...common} />
        </>
      ) : name === 'home' ? (
        <>
          <Path d="M4 11l8-7 8 7" {...common} />
          <Path d="M6 10v10h12V10" {...common} />
          <Rect x={10} y={14} width={4} height={6} {...common} />
        </>
      ) : name === 'dumbbell' ? (
        <>
          <Line x1={9} y1={12} x2={15} y2={12} {...common} />
          <Rect x={5} y={8} width={3} height={8} rx={1} {...common} />
          <Rect x={16} y={8} width={3} height={8} rx={1} {...common} />
          <Line x1={2} y1={10} x2={2} y2={14} {...common} />
          <Line x1={22} y1={10} x2={22} y2={14} {...common} />
          <Line x1={3.5} y1={12} x2={5} y2={12} {...common} />
          <Line x1={19} y1={12} x2={20.5} y2={12} {...common} />
        </>
      ) : name === 'today' ? (
        <>
          <Circle cx={12} cy={12} r={9} {...common} />
          <Circle cx={12} cy={12} r={4} {...common} />
          <Line x1={12} y1={3} x2={12} y2={6} {...common} />
        </>
      ) : name === 'diary' ? (
        <>
          <Rect x={4} y={3} width={16} height={18} rx={2} {...common} />
          <Line x1={8} y1={8} x2={16} y2={8} {...common} />
          <Line x1={8} y1={12} x2={16} y2={12} {...common} />
          <Line x1={8} y1={16} x2={13} y2={16} {...common} />
        </>
      ) : name === 'progress' ? (
        <>
          <Line x1={4} y1={20} x2={20} y2={20} {...common} />
          <Rect x={6} y={11} width={3} height={7} {...common} />
          <Rect x={11} y={6} width={3} height={12} {...common} />
          <Rect x={16} y={14} width={3} height={4} {...common} />
        </>
      ) : name === 'coach' ? (
        <>
          <Path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4z" {...common} />
          <Line x1={8} y1={8} x2={16} y2={8} {...common} />
          <Line x1={8} y1={12} x2={13} y2={12} {...common} />
        </>
      ) : name === 'profile' ? (
        <>
          <Circle cx={12} cy={8} r={4} {...common} />
          <Path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" {...common} />
        </>
      ) : name === 'plus' ? (
        <>
          <Line x1={12} y1={5} x2={12} y2={19} {...common} />
          <Line x1={5} y1={12} x2={19} y2={12} {...common} />
        </>
      ) : name === 'camera' ? (
        <>
          <Path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" {...common} />
          <Circle cx={12} cy={13} r={3.5} {...common} />
        </>
      ) : name === 'search' ? (
        <>
          <Circle cx={11} cy={11} r={6.5} {...common} />
          <Line x1={16} y1={16} x2={21} y2={21} {...common} />
        </>
      ) : name === 'pencil' ? (
        <>
          <Path d="M4 20l4-1 11-11-3-3L5 16z" {...common} />
          <Line x1={13} y1={8} x2={16} y2={11} {...common} />
        </>
      ) : name === 'water' ? (
        <Path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" {...common} />
      ) : name === 'scale' ? (
        <>
          <Rect x={4} y={4} width={16} height={16} rx={3} {...common} />
          <Path d="M8 11a4 4 0 0 1 8 0" {...common} />
          <Line x1={12} y1={11} x2={14} y2={8.5} {...common} />
        </>
      ) : name === 'activity' ? (
        <Polyline points="3,13 7,13 10,5 14,19 17,13 21,13" {...common} />
      ) : name === 'chevronLeft' ? (
        <Polyline points="15,5 8,12 15,19" {...common} />
      ) : name === 'chevronRight' ? (
        <Polyline points="9,5 16,12 9,19" {...common} />
      ) : name === 'check' ? (
        <Polyline points="5,12 10,17 19,7" {...common} />
      ) : name === 'close' ? (
        <>
          <Line x1={6} y1={6} x2={18} y2={18} {...common} />
          <Line x1={18} y1={6} x2={6} y2={18} {...common} />
        </>
      ) : name === 'send' ? (
        <>
          <Path d="M4 12L20 4l-4 16-4-7z" {...common} />
          <Line x1={12} y1={13} x2={20} y2={4} {...common} />
        </>
      ) : name === 'star' || name === 'starFilled' ? (
        <Path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z" {...common} fill={name === 'starFilled' ? stroke : 'none'} />
      ) : name === 'flame' ? (
        <Path d="M12 3c1 3 4 4.5 4 9a4 4 0 0 1-8 0c0-1.5.5-2.5 1-3 .3 1.2 1 2 2 2.3C11 8 11 5 12 3z" {...common} />
      ) : name === 'bolt' ? (
        <Path d="M13 3L5 14h6l-1 7 8-11h-6z" {...common} />
      ) : (
        <>
          <Polyline points="3,17 9,11 13,15 21,7" {...common} />
          <Polyline points="15,7 21,7 21,13" {...common} />
        </>
      )}
    </Svg>
  );
}
