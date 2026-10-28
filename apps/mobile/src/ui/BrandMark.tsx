import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';

import { config } from '@/lib/config';

import { useTheme } from './theme';

/** Three rising strokes: lean, upward, monochrome. A gym build can swap in its own square logo. */
export function BrandMark({ size = 48, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const stroke = color ?? colors.text;
  if (config.brandLogoUrl) {
    return <Image source={{ uri: config.brandLogoUrl }} style={{ width: size * 1.4, height: size }} contentFit="contain" accessibilityLabel="Logo" transition={0} />;
  }
  return (
    <Svg width={size * 1.4} height={size} viewBox="0 0 90 64" accessibilityLabel="Logo">
      <Path d="M22 56 L34 8" stroke={stroke} strokeWidth={9} strokeLinecap="round" />
      <Path d="M42 56 L54 8" stroke={stroke} strokeWidth={9} strokeLinecap="round" />
      <Path d="M62 56 L74 8" stroke={stroke} strokeWidth={9} strokeLinecap="round" />
    </Svg>
  );
}
