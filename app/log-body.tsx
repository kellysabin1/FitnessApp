import { router } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Field, Row, Screen } from '@/src/components/ui';
import { todayKey, useStore } from '@/src/store';
import { space } from '@/src/theme';
import { inputToKg, weightLabel } from '@/src/units';

export default function LogBody() {
  const units = useStore((s) => s.units);
  const addBody = useStore((s) => s.addBody);
  const [date, setDate] = useState(todayKey());
  const [weight, setWeight] = useState('');
  const [bf, setBf] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const lenUnit = units === 'us' ? 'in' : 'cm';
  const toCm = (v: string) => {
    const n = parseFloat(v);
    if (Number.isNaN(n)) return undefined;
    return units === 'us' ? n * 2.54 : n;
  };

  const save = () => {
    addBody({
      date,
      weightKg: inputToKg(weight, units),
      bodyFatPct: parseFloat(bf) || undefined,
      waistCm: toCm(waist),
      hipsCm: toCm(hips),
    });
    router.back();
  };

  return (
    <Screen padTop={false} contentStyle={{ gap: space(4) }}>
      <Body muted>Log whatever you have — even just weight. Weigh-ins work best first thing in the morning.</Body>
      <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
      <Row>
        <Field style={{ flex: 1 }} label="Weight" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" suffix={weightLabel(units)} autoFocus />
        <Field style={{ flex: 1 }} label="Body fat" value={bf} onChangeText={setBf} keyboardType="decimal-pad" suffix="%" />
      </Row>
      <Row>
        <Field style={{ flex: 1 }} label="Waist" value={waist} onChangeText={setWaist} keyboardType="decimal-pad" suffix={lenUnit} />
        <Field style={{ flex: 1 }} label="Hips" value={hips} onChangeText={setHips} keyboardType="decimal-pad" suffix={lenUnit} />
      </Row>
      <Button title="Save" onPress={save} disabled={!weight && !bf && !waist && !hips} style={{ marginTop: space(4) }} />
    </Screen>
  );
}
