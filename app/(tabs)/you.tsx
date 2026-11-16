import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Body, Button, Card, Chip, Display, Divider, Eyebrow, Field, H2, Icon, IconName, Italic, Row, Screen, SectionHeader } from '@/src/components/ui';
import { appleHealthSupported, connectAppleHealth } from '@/src/health/appleHealth';
import { connectOura, OURA_CLIENT_ID } from '@/src/health/oura';
import { syncHealth } from '@/src/health/sync';
import { Experience, Goal, GOAL_LABEL, useStore } from '@/src/store';
import { colors, fonts, space } from '@/src/theme';
import { cmToFtIn, ftInToCm, inputToKg, kgToInput, weightLabel } from '@/src/units';

export default function You() {
  const s = useStore();
  const p = s.profile;
  const u = s.units;
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const h = p.heightCm ? cmToFtIn(p.heightCm) : undefined;

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setMsg(null);
    try {
      const r = await fn();
      if (r) setMsg(r);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggleGoal = (g: Goal) =>
    s.updateProfile({ goals: p.goals.includes(g) ? p.goals.filter((x) => x !== g) : [...p.goals, g] });

  const reset = () => {
    const go = () => s.resetAll();
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (confirm('Erase all rep. data on this device?')) go();
    } else
      Alert.alert('Erase everything?', 'All workouts, weigh-ins and settings on this phone will be deleted.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase', style: 'destructive', onPress: go },
      ]);
  };

  return (
    <Screen>
      <Eyebrow>You</Eyebrow>
      <Display style={{ marginTop: space(2) }}>
        {p.name || 'Your'} <Italic>{p.name ? 'era.' : 'profile.'}</Italic>
      </Display>

      {/* Connections */}
      <SectionHeader title="Connections" />
      <Card style={{ gap: space(1) }}>
        <Connection
          icon="heart"
          tint={colors.sand}
          title="Apple Health"
          sub={
            appleHealthSupported
              ? s.appleHealthEnabled
                ? 'Connected · steps, sleep, heart rate, HRV, weight'
                : 'Steps, sleep, heart rate, HRV and weigh-ins'
              : 'Available in the iPhone app'
          }
          action={
            appleHealthSupported ? (
              s.appleHealthEnabled ? (
                <Text style={styles.on}>On</Text>
              ) : (
                <Button
                  small
                  title="Connect"
                  loading={busy === 'ah'}
                  onPress={() =>
                    run('ah', async () => {
                      const ok = await connectAppleHealth();
                      if (!ok) return 'Apple Health isn’t available on this device.';
                      s.set({ appleHealthEnabled: true });
                      await syncHealth(30);
                      return 'Apple Health connected ✨';
                    })
                  }
                />
              )
            ) : null
          }
        />
        <Divider />
        <Connection
          icon="radio-button-on"
          tint={colors.latte}
          title="RingConn"
          sub="Syncs through Apple Health. In the RingConn app: Me → Apple Health → turn on all categories."
        />
        <Divider />
        <Connection
          icon="ellipse-outline"
          tint={colors.cream}
          title="Oura"
          sub={s.oura ? 'Connected · readiness, sleep score, HRV, steps' : 'Readiness, sleep score, HRV and steps'}
          action={
            s.oura ? (
              <Button small variant="ghost" title="Disconnect" onPress={() => s.set({ oura: undefined })} />
            ) : (
              <Button
                small
                title="Connect"
                loading={busy === 'oura'}
                disabled={!OURA_CLIENT_ID}
                onPress={() =>
                  run('oura', async () => {
                    s.set({ oura: await connectOura() });
                    await syncHealth(30);
                    return 'Oura connected ✨';
                  })
                }
              />
            )
          }
        />
        {(s.appleHealthEnabled || s.oura) && (
          <Button
            small
            variant="secondary"
            icon="refresh"
            title="Sync now"
            loading={busy === 'sync'}
            style={{ marginTop: space(4) }}
            onPress={() =>
              run('sync', async () => {
                const errs = await syncHealth(30);
                return errs.length ? errs.join('\n') : 'All synced ✓';
              })
            }
          />
        )}
        {msg ? <Body style={{ marginTop: space(3), fontSize: 13, color: colors.latte }}>{msg}</Body> : null}
      </Card>

      {/* Profile */}
      <SectionHeader title="Profile" />
      <Card style={{ gap: space(4) }}>
        <Field label="Name" value={p.name} onChangeText={(name) => s.updateProfile({ name })} />
        <View style={{ gap: space(2) }}>
          <Text style={styles.label}>Units</Text>
          <Row gap={2}>
            <Chip label="lb · ft/in" active={u === 'us'} onPress={() => s.set({ units: 'us' })} />
            <Chip label="kg · cm" active={u === 'metric'} onPress={() => s.set({ units: 'metric' })} />
          </Row>
        </View>
        {u === 'us' ? (
          <Row>
            <NumField label="Height" suffix="ft" value={h ? String(h.ft) : ''} onCommit={(v) => s.updateProfile({ heightCm: ftInToCm(parseInt(v) || 0, h?.inch ?? 0) })} />
            <NumField label=" " suffix="in" value={h ? String(h.inch) : ''} onCommit={(v) => s.updateProfile({ heightCm: ftInToCm(h?.ft ?? 0, parseInt(v) || 0) })} />
          </Row>
        ) : (
          <NumField label="Height" suffix="cm" value={p.heightCm ? String(Math.round(p.heightCm)) : ''} onCommit={(v) => s.updateProfile({ heightCm: parseFloat(v) || undefined })} />
        )}
        <NumField
          label="Goal weight"
          suffix={weightLabel(u)}
          value={kgToInput(p.goalWeightKg, u)}
          onCommit={(v) => s.updateProfile({ goalWeightKg: inputToKg(v, u) })}
        />
        <NumField label="Daily step goal" suffix="steps" value={String(p.stepGoal)} onCommit={(v) => s.updateProfile({ stepGoal: parseInt(v) || p.stepGoal })} />
      </Card>

      <SectionHeader title="Goals & training" />
      <Card style={{ gap: space(4) }}>
        <Row gap={2} style={{ flexWrap: 'wrap' }}>
          {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
            <Chip key={g} label={GOAL_LABEL[g]} active={p.goals.includes(g)} onPress={() => toggleGoal(g)} />
          ))}
        </Row>
        <Divider />
        <Text style={styles.label}>Experience</Text>
        <Row gap={2}>
          {(['beginner', 'intermediate', 'advanced'] as Experience[]).map((e) => (
            <Chip key={e} label={e[0].toUpperCase() + e.slice(1)} active={p.experience === e} onPress={() => s.updateProfile({ experience: e })} />
          ))}
        </Row>
        <Text style={styles.label}>Days per week</Text>
        <Row gap={2}>
          {[2, 3, 4, 5, 6].map((d) => (
            <Chip key={d} label={String(d)} active={p.daysPerWeek === d} onPress={() => s.updateProfile({ daysPerWeek: d })} />
          ))}
        </Row>
        <Field label="Equipment" value={p.equipment} onChangeText={(equipment) => s.updateProfile({ equipment })} />
        <Field label="Injuries & preferences" value={p.notes} onChangeText={(notes) => s.updateProfile({ notes })} multiline />
      </Card>

      <SectionHeader title="Coach server" />
      <Card style={{ gap: space(4) }}>
        <Body muted style={{ fontSize: 13 }}>
          The AI coach runs on your own small server so your Claude key stays private. See the README for the 5-minute setup.
        </Body>
        <Field
          label="Server URL"
          value={s.server.url}
          onChangeText={(url) => s.set({ server: { ...s.server, url } })}
          placeholder="https://rep-coach.onrender.com"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field
          label="App password"
          value={s.server.token}
          onChangeText={(token) => s.set({ server: { ...s.server, token } })}
          placeholder="APP_TOKEN from your server"
          autoCapitalize="none"
          secureTextEntry
        />
      </Card>

      <Button title="Erase all data" variant="danger" style={{ marginTop: space(8) }} onPress={reset} />
      <H2 style={{ textAlign: 'center', marginTop: space(8), color: colors.textFaint, fontSize: 18 }}>
        rep. <Italic style={{ color: colors.textFaint }}>v1</Italic>
      </H2>
    </Screen>
  );
}

function Connection({ icon, tint, title, sub, action }: { icon: IconName; tint: string; title: string; sub: string; action?: React.ReactNode }) {
  return (
    <Row style={{ paddingVertical: space(1) }}>
      <View style={styles.connIcon}>
        <Icon name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.connTitle}>{title}</Text>
        <Text style={styles.connSub}>{sub}</Text>
      </View>
      {action}
    </Row>
  );
}

/** Field that only commits on blur, so partially typed numbers don't get mangled. */
function NumField({ label, suffix, value, onCommit }: { label: string; suffix?: string; value: string; onCommit: (v: string) => void }) {
  const [t, setT] = useState(value);
  const [focused, setFocused] = useState(false);
  return (
    <Field
      style={{ flex: 1 }}
      label={label}
      suffix={suffix}
      value={focused ? t : value}
      onFocus={() => { setT(value); setFocused(true); }}
      onChangeText={setT}
      onBlur={() => { setFocused(false); onCommit(t); }}
      keyboardType="decimal-pad"
    />
  );
}

const styles = {
  label: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.4 },
  on: { fontFamily: fonts.bodyBold, color: colors.latte, fontSize: 13 },
  connIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgRaised,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  connTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.cream },
  connSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 2 },
};
