import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Body, Button, Chip, Field, Row, Screen } from '@/src/components/ui';
import { allExercises } from '@/src/exercises';
import { todayKey, uid, useStore } from '@/src/store';
import { colors, fonts, space } from '@/src/theme';
import {
  fmtTargetValue,
  isRate,
  MEASUREMENT_LABEL,
  type MeasurementField,
  parseTargetInput,
  suggestedStart,
  type Target,
  TARGET_KIND_LABEL,
  type TargetKind,
  targetUnit,
} from '@/src/training';

const KINDS = Object.keys(TARGET_KIND_LABEL) as TargetKind[];
const WEEKS = [2, 3, 4, 6, 8, 12];

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return todayKey(d);
};

/** New target, or edit an existing one (?id=…). Coach suggestions prefill via ?kind=&title=&exercise=&value=&weeks= */
export default function TargetForm() {
  const params = useLocalSearchParams<{ id?: string; kind?: string; title?: string; exercise?: string; value?: string; weeks?: string }>();
  const units = useStore((s) => s.units);
  const existing = useStore((s) => s.targets.find((t) => t.id === params.id));
  const saveTarget = useStore((s) => s.saveTarget);
  const workouts = useStore((s) => s.workouts);
  const body = useStore((s) => s.body);
  const health = useStore((s) => s.health);

  const initialKind = (existing?.kind ?? (KINDS.includes(params.kind as TargetKind) ? params.kind : 'bodyweight')) as TargetKind;
  const [kind, setKind] = useState<TargetKind>(initialKind);
  const [title, setTitle] = useState(existing ? (existing.autoTitle ? '' : existing.title) : (params.title ?? ''));
  const [exercise, setExercise] = useState(existing?.exercise ?? params.exercise ?? '');
  const [exQuery, setExQuery] = useState('');
  const [measurement, setMeasurement] = useState<MeasurementField>(existing?.measurement ?? 'waistCm');
  const [runDistance, setRunDistance] = useState(existing?.runDistance ?? '1 mile');
  const [unit, setUnit] = useState(existing?.unit ?? '');
  const probe = { kind, measurement };

  const autoStart = useMemo(
    () => suggestedStart(kind, { workouts, body, health }, { exercise, measurement }),
    [kind, exercise, measurement, workouts, body, health],
  );
  const [startText, setStartText] = useState(existing ? fmtTargetValue(existing, existing.startValue, units).replace(/,/g, '') : '');
  // coach suggestions give the target in the user's units already (weights in lb/kg as shown)
  const [targetText, setTargetText] = useState(
    existing ? fmtTargetValue(existing, existing.targetValue, units).replace(/,/g, '') : (params.value ?? ''),
  );
  const initialWeeks = params.weeks ? parseInt(params.weeks, 10) : 4;
  const [weeks, setWeeks] = useState<number | null>(existing ? null : WEEKS.includes(initialWeeks) ? initialWeeks : null);
  const [customDays, setCustomDays] = useState(() =>
    existing ? String(Math.max(1, Math.round((+new Date(existing.endDate + 'T12:00') - Date.now()) / 86400000))) : String(initialWeeks * 7),
  );
  const [err, setErr] = useState<string | null>(null);

  const startShown = startText || (autoStart != null ? fmtTargetValue(probe, autoStart, units).replace(/,/g, '') : '');
  const startVal = isRate(kind) ? 0 : parseTargetInput(probe, startShown, units);
  const targetVal = parseTargetInput(probe, targetText, units);
  const days = weeks ? weeks * 7 : parseInt(customDays, 10);
  const endDate = days > 0 ? addDays(days) : undefined;
  const u = targetUnit({ kind, unit, measurement }, units);

  const exMatches = useMemo(() => {
    const t = exQuery.trim().toLowerCase();
    if (!t) return [];
    return allExercises()
      .filter((e) => e.name.toLowerCase().includes(t))
      .slice(0, 6)
      .map((e) => e.name);
  }, [exQuery]);

  const suggestTitle = () => {
    if (title.trim()) return title.trim();
    const tv = targetText.trim();
    switch (kind) {
      case 'bodyweight':
        return `Reach ${tv} ${u}`;
      case 'lift':
        return `${exercise} ${tv} ${u}`;
      case 'run':
        return `${runDistance} in ${tv}`;
      case 'steps':
        return `${tv} steps a day`;
      case 'workouts':
        return `${tv} workouts a week`;
      case 'measurement':
        return `${MEASUREMENT_LABEL[measurement]} ${tv} ${u}`;
      default:
        return `${tv} ${unit}`.trim();
    }
  };

  const problem =
    targetVal == null
      ? kind === 'run'
        ? 'Enter a target time like 6:00.'
        : 'Enter a target number.'
      : !isRate(kind) && startVal == null
        ? 'Enter where you are now.'
        : !isRate(kind) && startVal === targetVal
          ? 'Target should differ from where you are now.'
          : kind === 'lift' && !exercise.trim()
            ? 'Pick the exercise.'
            : kind === 'custom' && !title.trim() && !unit.trim()
              ? 'Name it or give it a unit.'
              : !endDate
                ? 'Pick a timeframe.'
                : null;

  const save = () => {
    if (problem || targetVal == null || !endDate) return setErr(problem);
    const now = new Date().toISOString();
    const base: Target = existing ?? {
      id: uid(),
      kind,
      title: '',
      startValue: 0,
      targetValue: 0,
      startDate: todayKey(),
      endDate,
      checkins: [],
      status: 'active',
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    const changed = existing && (existing.targetValue !== targetVal || existing.endDate !== endDate);
    const t: Target = {
      ...base,
      kind,
      title: suggestTitle(),
      autoTitle: !title.trim(),
      startValue: isRate(kind) ? 0 : (startVal as number),
      targetValue: targetVal,
      endDate,
      exercise: kind === 'lift' ? exercise.trim() : undefined,
      measurement: kind === 'measurement' ? measurement : undefined,
      runDistance: kind === 'run' ? runDistance.trim() : undefined,
      unit: kind === 'custom' ? unit.trim() : undefined,
      history: changed ? [...base.history, { at: now, targetValue: existing!.targetValue, endDate: existing!.endDate }] : base.history,
      status: existing?.status === 'archived' ? 'archived' : 'active',
    };
    // a manual starting value for check-in based kinds becomes the first check-in
    if (!existing && (kind === 'run' || kind === 'custom') && startVal != null) t.checkins = [{ date: todayKey(), value: startVal }];
    saveTarget(t);
    router.replace({ pathname: '/target/[id]', params: { id: t.id, fresh: existing ? '' : '1' } });
  };

  return (
    <Screen padTop={false} contentStyle={{ gap: space(5), paddingBottom: space(16) }}>
      {!existing ? (
        <View style={{ gap: space(2) }}>
          <Text style={label}>What kind of target?</Text>
          <Row gap={2} style={{ flexWrap: 'wrap' }}>
            {KINDS.map((k) => (
              <Chip
                key={k}
                label={TARGET_KIND_LABEL[k]}
                active={kind === k}
                onPress={() => {
                  setKind(k);
                  setStartText('');
                }}
              />
            ))}
          </Row>
        </View>
      ) : null}

      {kind === 'lift' ? (
        <View style={{ gap: space(2) }}>
          <Field
            label="Exercise"
            value={exercise || exQuery}
            onChangeText={(t) => {
              setExercise('');
              setExQuery(t);
            }}
            placeholder="Search, e.g. hip thrust"
          />
          {exMatches.length && !exercise ? (
            <Row gap={2} style={{ flexWrap: 'wrap' }}>
              {exMatches.map((m) => (
                <Chip
                  key={m}
                  label={m}
                  onPress={() => {
                    setExercise(m);
                    setExQuery('');
                    setStartText('');
                  }}
                />
              ))}
            </Row>
          ) : null}
        </View>
      ) : null}
      {kind === 'measurement' ? (
        <Row gap={2}>
          {(Object.keys(MEASUREMENT_LABEL) as MeasurementField[]).map((m) => (
            <Chip
              key={m}
              label={MEASUREMENT_LABEL[m]}
              active={measurement === m}
              onPress={() => {
                setMeasurement(m);
                setStartText('');
              }}
            />
          ))}
        </Row>
      ) : null}
      {kind === 'run' ? <Field label="Distance" value={runDistance} onChangeText={setRunDistance} placeholder="1 mile, 5K…" /> : null}
      {kind === 'custom' ? <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="e.g. pull-ups, minutes plank" /> : null}

      <Row>
        {!isRate(kind) ? (
          <Field
            style={{ flex: 1 }}
            label={kind === 'run' ? 'Your time now' : 'Where you are now'}
            value={startShown}
            onChangeText={setStartText}
            placeholder={kind === 'run' ? '7:00' : '—'}
            keyboardType={kind === 'run' ? 'numbers-and-punctuation' : 'decimal-pad'}
            suffix={kind === 'run' ? 'min:sec' : u}
          />
        ) : null}
        <Field
          style={{ flex: 1 }}
          label={isRate(kind) ? 'Target' : 'Target'}
          value={targetText}
          onChangeText={setTargetText}
          placeholder={kind === 'run' ? '6:00' : kind === 'steps' ? '10000' : '—'}
          keyboardType={kind === 'run' ? 'numbers-and-punctuation' : 'decimal-pad'}
          suffix={kind === 'run' ? 'min:sec' : u}
        />
      </Row>
      {!isRate(kind) && autoStart != null && !startText ? (
        <Body muted style={{ fontSize: 12, marginTop: -space(3) }}>
          Filled in from your logged data — change it if it’s off.
        </Body>
      ) : null}

      <View style={{ gap: space(2) }}>
        <Text style={label}>Timeframe</Text>
        <Row gap={2} style={{ flexWrap: 'wrap' }}>
          {WEEKS.map((w) => (
            <Chip key={w} label={`${w} weeks`} active={weeks === w} onPress={() => setWeeks(w)} />
          ))}
          <Chip label="Custom" active={weeks === null} onPress={() => setWeeks(null)} />
        </Row>
        {weeks === null ? (
          <Field label="Days from today" value={customDays} onChangeText={setCustomDays} keyboardType="number-pad" suffix="days" />
        ) : null}
        {endDate ? (
          <Body muted style={{ fontSize: 13 }}>
            By {new Date(endDate + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </Body>
        ) : null}
      </View>

      <Field
        label="Name (optional)"
        value={title}
        onChangeText={setTitle}
        placeholder={targetVal != null ? suggestTitle() : 'e.g. Lose 4 lb before the trip'}
      />

      <Button title={existing ? 'Save changes' : 'Create target'} icon="flag-outline" disabled={!!problem} onPress={save} />
      {problem && targetText ? <Body style={{ color: colors.sand, fontSize: 13, marginTop: -space(3) }}>{problem}</Body> : null}
      {err ? <Body style={{ color: colors.sand, fontSize: 13 }}>{err}</Body> : null}
      {existing ? (
        <Body muted style={{ fontSize: 12 }}>
          Changing the target or date keeps the old version in this target’s history.
        </Body>
      ) : null}
    </Screen>
  );
}

const label = { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.4 } as const;
