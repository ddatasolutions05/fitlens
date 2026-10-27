// Small chart kit on react-native-svg. Missing days are gaps, never zeros.
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { Text, space, useTheme } from '@/ui';

export interface SeriesPoint {
  label: string;
  value: number | null;
  target?: number | null;
}

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(e.nativeEvent.layout.width)];
}

function niceMax(values: number[]): number {
  const max = Math.max(0, ...values);
  if (max === 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = max / pow;
  const nice = step <= 1 ? 1 : step <= 2 ? 2 : step <= 5 ? 5 : 10;
  return nice * pow;
}

export function ChartFrame({ title, unit, children, legend, summary }: { title: string; unit: string; children: React.ReactNode; legend?: React.ReactNode; summary?: string }) {
  return (
    <View style={{ gap: space.sm }} accessible accessibilityLabel={`${title} chart. ${summary ?? ''}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="textMuted">
          {unit}
        </Text>
      </View>
      {children}
      {legend}
      {summary ? (
        <Text variant="caption" color="textFaint">
          {summary}
        </Text>
      ) : null}
    </View>
  );
}

const H = 150;
const PAD_L = 36;
const PAD_B = 18;
const PAD_T = 8;

/** Bars per day with an optional target line. Null values draw no bar. */
export function BarChart({ data, color, targetColor }: { data: SeriesPoint[]; color: string; targetColor?: string }) {
  const { colors } = useTheme();
  const [width, onLayout] = useWidth();
  const values = data.map((d) => d.value).filter((v): v is number => v != null);
  const targets = data.map((d) => d.target ?? null).filter((v): v is number => v != null);
  const max = niceMax([...values, ...targets]);
  const innerW = Math.max(0, width - PAD_L - 4);
  const innerH = H - PAD_B - PAD_T;
  const n = data.length;
  const slot = n > 0 ? innerW / n : 0;
  const barW = Math.max(2, slot * 0.6);
  const y = (v: number) => PAD_T + innerH - (v / max) * innerH;
  const labelEvery = n > 40 ? 15 : n > 14 ? 7 : 1;

  return (
    <View onLayout={onLayout} style={{ height: H }}>
      {width > 0 ? (
        <Svg width={width} height={H}>
          {[0, 0.5, 1].map((f) => (
            <Line key={f} x1={PAD_L} x2={width} y1={y(max * f)} y2={y(max * f)} stroke={colors.border} strokeWidth={1} />
          ))}
          {[0, 0.5, 1].map((f) => (
            <SvgText key={`t${f}`} x={PAD_L - 6} y={y(max * f) + 4} fontSize={10} fill={colors.textFaint} textAnchor="end">
              {Math.round(max * f).toLocaleString()}
            </SvgText>
          ))}
          {data.map((d, i) => {
            const x = PAD_L + i * slot + (slot - barW) / 2;
            return (
              <Rect key={d.label} x={x} y={d.value == null ? y(0) : y(d.value)} width={barW} height={d.value == null ? 0 : y(0) - y(d.value)} fill={color} rx={2} />
            );
          })}
          {data.map((d, i) =>
            d.target != null ? (
              <Line key={`g${d.label}`} x1={PAD_L + i * slot} x2={PAD_L + (i + 1) * slot} y1={y(d.target)} y2={y(d.target)} stroke={targetColor ?? colors.text} strokeWidth={1.5} strokeDasharray="3 3" />
            ) : null,
          )}
          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <SvgText key={`l${d.label}`} x={PAD_L + i * slot + slot / 2} y={H - 4} fontSize={10} fill={colors.textFaint} textAnchor="middle">
                {d.label}
              </SvgText>
            ) : null,
          )}
        </Svg>
      ) : null}
    </View>
  );
}

/** Line chart with gaps where a value is null, plus an optional smoothed line. */
export function LineChart({ data, smooth, color, smoothColor, minZero }: { data: SeriesPoint[]; smooth?: (number | null)[]; color: string; smoothColor?: string; minZero?: boolean }) {
  const { colors } = useTheme();
  const [width, onLayout] = useWidth();
  const values = [...data.map((d) => d.value), ...(smooth ?? [])].filter((v): v is number => v != null);
  if (values.length === 0) {
    return (
      <View onLayout={onLayout} style={{ height: H, justifyContent: 'center' }}>
        <Text color="textMuted" align="center">
          Not logged in this range
        </Text>
      </View>
    );
  }
  const lo = minZero ? 0 : Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  const innerW = Math.max(0, width - PAD_L - 8);
  const innerH = H - PAD_B - PAD_T;
  const n = data.length;
  const x = (i: number) => PAD_L + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD_T + innerH - ((v - lo) / (hi - lo || 1)) * innerH;
  const labelEvery = n > 40 ? 15 : n > 14 ? 7 : 1;

  const pathFor = (vals: (number | null)[]): string => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };

  return (
    <View onLayout={onLayout} style={{ height: H }}>
      {width > 0 ? (
        <Svg width={width} height={H}>
          {[lo, (lo + hi) / 2, hi].map((v) => (
            <Line key={v} x1={PAD_L} x2={width} y1={y(v)} y2={y(v)} stroke={colors.border} strokeWidth={1} />
          ))}
          {[lo, (lo + hi) / 2, hi].map((v) => (
            <SvgText key={`t${v}`} x={PAD_L - 6} y={y(v) + 4} fontSize={10} fill={colors.textFaint} textAnchor="end">
              {Number.isInteger(v) ? v : v.toFixed(1)}
            </SvgText>
          ))}
          {smooth ? <Path d={pathFor(smooth)} stroke={smoothColor ?? colors.accent} strokeWidth={2.5} fill="none" /> : null}
          <Path d={pathFor(data.map((d) => d.value))} stroke={color} strokeWidth={smooth ? 1 : 2} fill="none" opacity={smooth ? 0.6 : 1} />
          {data.map((d, i) => (d.value != null ? <Circle key={d.label} cx={x(i)} cy={y(d.value)} r={smooth ? 2.5 : 3} fill={color} /> : null))}
          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <SvgText key={`l${d.label}`} x={x(i)} y={H - 4} fontSize={10} fill={colors.textFaint} textAnchor="middle">
                {d.label}
              </SvgText>
            ) : null,
          )}
        </Svg>
      ) : null}
    </View>
  );
}

/** One square per day: complete, partial or not logged. */
export function ConsistencyGrid({ days }: { days: { label: string; status: 'complete' | 'partial' | 'not_logged' }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {days.map((d) => (
        <View
          key={d.label}
          accessibilityLabel={`${d.label}: ${d.status.replace('_', ' ')}`}
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            backgroundColor: d.status === 'complete' ? colors.accent : d.status === 'partial' ? colors.accentSoft : colors.surfaceAlt,
            borderWidth: d.status === 'not_logged' ? 1 : 0,
            borderColor: colors.border,
          }}
        />
      ))}
    </View>
  );
}
