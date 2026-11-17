import { router } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Chip, Field, Row, Screen } from '@/src/components/ui';
import { syncUp } from '@/src/social/api';
import { healthForDate, todayKey, useStore } from '@/src/store';
import { colors, space } from '@/src/theme';

/** Type in steps by hand (until Apple Health / RingConn / Oura are connected). */
export default function LogSteps() {
  const health = useStore((s) => s.health);
  const upsert = useStore((s) => s.upsertHealth);
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return todayKey(d);
  })();
  const [day, setDay] = useState(todayKey());
  const current = healthForDate(health, day).steps;
  const [steps, setSteps] = useState(current != null ? String(current) : '');
  const [err, setErr] = useState<string | null>(null);
  const n = parseInt(steps.replace(/[^0-9]/g, ''), 10);

  const save = async () => {
    upsert([{ date: day, steps: n, source: 'manual' }]);
    try {
      await syncUp();
      router.back();
    } catch (e) {
      setErr(`Saved on this phone, but couldn’t share it yet: ${(e as Error).message}`);
    }
  };

  return (
    <Screen padTop={false} contentStyle={{ gap: space(5) }}>
      <Body muted>Check your phone’s Health app or your ring app and type in the total.</Body>
      <Row gap={2}>
        <Chip
          label="Today"
          active={day === todayKey()}
          onPress={() => {
            setDay(todayKey());
            setSteps(String(healthForDate(health, todayKey()).steps ?? ''));
          }}
        />
        <Chip
          label="Yesterday"
          active={day === yesterday}
          onPress={() => {
            setDay(yesterday);
            setSteps(String(healthForDate(health, yesterday).steps ?? ''));
          }}
        />
      </Row>
      <Field label="Steps" value={steps} onChangeText={setSteps} keyboardType="number-pad" placeholder="8,500" suffix="steps" autoFocus />
      <Button title="Save steps" disabled={!(n >= 0 && n <= 200000)} onPress={save} />
      {err ? <Body style={{ color: colors.sand, fontSize: 14 }}>{err}</Body> : null}
    </Screen>
  );
}
