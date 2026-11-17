import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { colors, fonts, space } from '../theme';
import { Chip, Field, Row } from './ui';

export interface When {
  start: Date;
  durationMin: number;
}

const TIMES: { label: string; h: number; m: number }[] = [
  { label: 'Early', h: 6, m: 30 },
  { label: 'Morning', h: 9, m: 0 },
  { label: 'Midday', h: 12, m: 0 },
  { label: 'Afternoon', h: 15, m: 0 },
  { label: 'Evening', h: 18, m: 0 },
  { label: 'Night', h: 20, m: 30 },
];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function lastDays(n: number) {
  const out: Date[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push(d);
  }
  return out;
}

const dayLabel = (d: Date, i: number) =>
  i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** Parse "7", "7:15", "7:15pm", "19:30" → [h, m] */
export function parseTime(text: string): [number, number] | null {
  const t = text.trim().toLowerCase().replace(/\s/g, '');
  const m = t.match(/^(\d{1,2})(?::?(\d{2}))?(am|pm|a|p)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3];
  if (ap?.startsWith('p') && h < 12) h += 12;
  if (ap?.startsWith('a') && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return [h, min];
}

export const isFuture = (w: When) => +w.start > Date.now() + 60_000;

/** Pick the day, time and length of a workout that already happened. */
export function WhenPicker({ value, onChange }: { value: When; onChange: (w: When) => void }) {
  const days = lastDays(7);
  const [timeText, setTimeText] = useState(fmtTime(value.start));
  const [durText, setDurText] = useState(String(value.durationMin));

  useEffect(() => setTimeText(fmtTime(value.start)), [value.start]);

  const setDay = (d: Date) => {
    const n = new Date(d);
    n.setHours(value.start.getHours(), value.start.getMinutes(), 0, 0);
    onChange({ ...value, start: n });
  };
  const setTime = (h: number, m: number) => {
    const n = new Date(value.start);
    n.setHours(h, m, 0, 0);
    onChange({ ...value, start: n });
  };

  const activeSlot = TIMES.find((t) => t.h === value.start.getHours() && t.m === value.start.getMinutes());

  return (
    <View style={{ gap: space(4) }}>
      <View style={{ gap: space(2) }}>
        <Text style={label}>Day</Text>
        <Row gap={2} style={{ flexWrap: 'wrap' }}>
          {days.map((d, i) => (
            <Chip key={d.toISOString()} label={dayLabel(d, i)} active={sameDay(d, value.start)} onPress={() => setDay(d)} />
          ))}
        </Row>
      </View>
      <View style={{ gap: space(2) }}>
        <Text style={label}>Time</Text>
        <Row gap={2} style={{ flexWrap: 'wrap' }}>
          {TIMES.map((t) => (
            <Chip key={t.label} label={t.label} active={activeSlot?.label === t.label} onPress={() => setTime(t.h, t.m)} />
          ))}
        </Row>
      </View>
      <Row>
        <Field
          style={{ flex: 1 }}
          label="Exact start time"
          value={timeText}
          onChangeText={(t) => {
            setTimeText(t);
            const p = parseTime(t);
            if (p) setTime(p[0], p[1]);
          }}
          placeholder="7:15am"
          autoCapitalize="none"
        />
        <Field
          style={{ flex: 1 }}
          label="How long"
          value={durText}
          onChangeText={(t) => {
            setDurText(t);
            const n = parseInt(t, 10);
            if (n > 0 && n < 600) onChange({ ...value, durationMin: n });
          }}
          keyboardType="number-pad"
          suffix="min"
        />
      </Row>
      {isFuture(value) ? (
        <Text style={[label, { color: colors.sand }]}>That time hasn’t happened yet — pick an earlier time.</Text>
      ) : null}
    </View>
  );
}

const label = { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.4 } as const;
