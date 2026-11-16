import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors, fonts } from '../theme';

/** Circular progress ring. */
export function Ring({
  size = 120,
  stroke = 10,
  progress,
  color = colors.gold,
  track = 'rgba(243,235,221,0.08)',
  children,
}: {
  size?: number;
  stroke?: number;
  progress: number; // 0..1
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress || 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - p)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Smooth area line chart. */
export function LineChart({
  data,
  width,
  height = 140,
  color = colors.blush,
  goal,
  formatY,
}: {
  data: { label: string; value: number }[];
  width: number;
  height?: number;
  color?: string;
  goal?: number;
  formatY?: (n: number) => string;
}) {
  if (data.length < 2) return null;
  const pad = 8;
  const vals = data.map((d) => d.value).concat(goal != null ? [goal] : []);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (max - min < 1) { min -= 1; max += 1; }
  const range = max - min;
  const x = (i: number) => pad + (i / (data.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / range) * (height - pad * 2);
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  // Catmull-Rom → bezier for a soft curve
  let line = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    line += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }
  const area = `${line} L ${pts[pts.length - 1][0]} ${height} L ${pts[0][0]} ${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {goal != null ? (
          <Path d={`M ${pad} ${y(goal)} L ${width - pad} ${y(goal)}`} stroke={colors.gold} strokeDasharray="4 6" strokeWidth={1} opacity={0.7} />
        ) : null}
        <Path d={area} fill="url(#fill)" />
        <Path d={line} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Circle cx={last[0]} cy={last[1]} r={5} fill={colors.bg} stroke={color} strokeWidth={2.5} />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={axis}>{data[0].label}</Text>
        {formatY ? <Text style={axis}>{`${formatY(min)} – ${formatY(max)}`}</Text> : null}
        <Text style={axis}>{data[data.length - 1].label}</Text>
      </View>
    </View>
  );
}

/** Simple vertical bars (e.g. steps per day). */
export function Bars({
  data,
  width,
  height = 110,
  goal,
  color = colors.mocha,
  highlight = colors.gold,
}: {
  data: { label: string; value: number }[];
  width: number;
  height?: number;
  goal?: number;
  color?: string;
  highlight?: string;
}) {
  const max = Math.max(goal ?? 0, ...data.map((d) => d.value), 1);
  const gap = 8;
  const bw = (width - gap * (data.length - 1)) / data.length;
  return (
    <View>
      <Svg width={width} height={height}>
        {goal ? (
          <Path d={`M 0 ${height - (goal / max) * height} L ${width} ${height - (goal / max) * height}`} stroke={colors.gold} strokeDasharray="3 5" opacity={0.6} />
        ) : null}
        {data.map((d, i) => {
          const h = Math.max(3, (d.value / max) * (height - 4));
          const hit = goal != null && d.value >= goal;
          return <Rect key={i} x={i * (bw + gap)} y={height - h} width={bw} height={h} rx={Math.min(8, bw / 2)} fill={hit ? highlight : color} opacity={d.value ? 1 : 0.25} />;
        })}
      </Svg>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {data.map((d, i) => (
          <Text key={i} style={[axis, { width: bw + (i < data.length - 1 ? gap : 0), textAlign: 'left' }]}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const axis = { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint };
