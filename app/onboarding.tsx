import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { Body, Button, Chip, Display, Eyebrow, Field, Heart, Italic, Row, Screen } from '@/src/components/ui';
import { Experience, Goal, GOAL_LABEL, todayKey, useStore } from '@/src/store';
import { colors, fonts, space } from '@/src/theme';
import { Units, ftInToCm, inputToKg, weightLabel } from '@/src/units';

const STEPS = 5;

export default function Onboarding() {
  const s = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(s.profile.name);
  const [goals, setGoals] = useState<Goal[]>(s.profile.goals);
  const [units, setUnits] = useState<Units>(s.units);
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  const [cm, setCm] = useState('');
  const [weight, setWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [experience, setExperience] = useState<Experience>(s.profile.experience);
  const [days, setDays] = useState(s.profile.daysPerWeek);
  const [equipment, setEquipment] = useState(s.profile.equipment);
  const [notes, setNotes] = useState(s.profile.notes);
  const [stepGoal, setStepGoal] = useState(String(s.profile.stepGoal));

  const toggleGoal = (g: Goal) => setGoals((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  const finish = () => {
    const heightCm =
      units === 'us'
        ? ft
          ? ftInToCm(parseInt(ft) || 0, parseInt(inch) || 0)
          : undefined
        : parseFloat(cm) || undefined;
    s.set({ units });
    s.updateProfile({
      name: name.trim(),
      goals,
      heightCm,
      goalWeightKg: inputToKg(goalWeight, units),
      birthYear: parseInt(birthYear) || undefined,
      experience,
      daysPerWeek: days,
      equipment,
      notes,
      stepGoal: parseInt(stepGoal) || 8000,
    });
    const w = inputToKg(weight, units);
    if (w) s.addBody({ date: todayKey(), weightKg: w });
    s.set({ onboarded: true });
    router.replace('/');
  };

  const canNext = step === 0 ? name.trim().length > 0 : step === 1 ? goals.length > 0 : true;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ paddingBottom: space(10) }}>
        <Row gap={1.5} style={{ marginBottom: space(10) }}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <View
              key={i}
              style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? colors.latte : colors.line }}
            />
          ))}
        </Row>

        {step === 0 && (
          <View style={{ gap: space(5) }}>
            <Row gap={3}>
              <Heart size={26} />
              <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.cream, letterSpacing: 0.5 }}>rep.</Text>
            </Row>
            <Eyebrow>Welcome</Eyebrow>
            <Display>
              Your strongest era <Italic>starts here.</Italic>
            </Display>
            <Body muted>Log every lift, flow and walk. Your coach learns your goals, your data and your recovery.</Body>
            <Field label="What should we call you?" value={name} onChangeText={setName} placeholder="Your name" autoFocus />
          </View>
        )}

        {step === 1 && (
          <View style={{ gap: space(5) }}>
            <Eyebrow>Step 2 · Goals</Eyebrow>
            <Display>
              What are we <Italic>working toward?</Italic>
            </Display>
            <Body muted>Pick everything that applies — your coach will balance them.</Body>
            <Row gap={2} style={{ flexWrap: 'wrap' }}>
              {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
                <Chip key={g} label={GOAL_LABEL[g]} active={goals.includes(g)} onPress={() => toggleGoal(g)} />
              ))}
            </Row>
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: space(5) }}>
            <Eyebrow>Step 3 · Body</Eyebrow>
            <Display>
              A little <Italic>about you.</Italic>
            </Display>
            <Row gap={2}>
              <Chip label="lb · ft/in" active={units === 'us'} onPress={() => setUnits('us')} />
              <Chip label="kg · cm" active={units === 'metric'} onPress={() => setUnits('metric')} />
            </Row>
            {units === 'us' ? (
              <Row>
                <Field style={{ flex: 1 }} label="Height" value={ft} onChangeText={setFt} keyboardType="number-pad" placeholder="5" suffix="ft" />
                <Field style={{ flex: 1 }} label=" " value={inch} onChangeText={setInch} keyboardType="number-pad" placeholder="5" suffix="in" />
              </Row>
            ) : (
              <Field label="Height" value={cm} onChangeText={setCm} keyboardType="decimal-pad" placeholder="165" suffix="cm" />
            )}
            <Row>
              <Field style={{ flex: 1 }} label="Current weight" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" suffix={weightLabel(units)} />
              <Field style={{ flex: 1 }} label="Goal weight" value={goalWeight} onChangeText={setGoalWeight} keyboardType="decimal-pad" suffix={weightLabel(units)} />
            </Row>
            <Field label="Birth year (optional)" value={birthYear} onChangeText={setBirthYear} keyboardType="number-pad" placeholder="1998" />
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: space(5) }}>
            <Eyebrow>Step 4 · Training</Eyebrow>
            <Display>
              How do you <Italic>like to move?</Italic>
            </Display>
            <Text style={label}>Experience</Text>
            <Row gap={2}>
              {(['beginner', 'intermediate', 'advanced'] as Experience[]).map((e) => (
                <Chip key={e} label={e[0].toUpperCase() + e.slice(1)} active={experience === e} onPress={() => setExperience(e)} />
              ))}
            </Row>
            <Text style={label}>Days per week</Text>
            <Row gap={2}>
              {[2, 3, 4, 5, 6].map((d) => (
                <Pressable key={d} onPress={() => setDays(d)} style={[dayDot, days === d && { backgroundColor: colors.burgundy, borderColor: 'rgba(216,193,166,0.45)' }]}>
                  <Text style={{ color: colors.cream, fontFamily: fonts.bodyMedium }}>{d}</Text>
                </Pressable>
              ))}
            </Row>
            <Field label="Equipment you have" value={equipment} onChangeText={setEquipment} placeholder="Full gym, reformer, home dumbbells…" />
            <Field label="Injuries or preferences" value={notes} onChangeText={setNotes} placeholder="e.g. sensitive knees, love hip thrusts, hate burpees" multiline />
          </View>
        )}

        {step === 4 && (
          <View style={{ gap: space(5) }}>
            <Eyebrow>Step 5 · Daily movement</Eyebrow>
            <Display>
              Set your <Italic>step goal.</Italic>
            </Display>
            <Body muted>Start where you are — your coach will nudge this up as you get consistent.</Body>
            <Row gap={2} style={{ flexWrap: 'wrap' }}>
              {['6000', '8000', '10000', '12000'].map((v) => (
                <Chip key={v} label={Number(v).toLocaleString()} active={stepGoal === v} onPress={() => setStepGoal(v)} />
              ))}
            </Row>
            <Field label="Or enter your own" value={stepGoal} onChangeText={setStepGoal} keyboardType="number-pad" suffix="steps" />
          </View>
        )}

        <View style={{ marginTop: space(10), gap: space(3) }}>
          <Button
            title={step === STEPS - 1 ? 'Enter rep.' : 'Continue'}
            disabled={!canNext}
            onPress={() => (step === STEPS - 1 ? finish() : setStep(step + 1))}
          />
          {step > 0 ? <Button title="Back" variant="ghost" onPress={() => setStep(step - 1)} /> : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const label = { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.4 } as const;
const dayDot = {
  width: 48,
  height: 48,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: colors.line,
  backgroundColor: colors.bgRaised,
  alignItems: 'center',
  justifyContent: 'center',
} as const;
