import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native';
import { Body, Button, Card, Divider, Icon, Row, Screen } from '@/src/components/ui';
import { enablePush, pushState, type PushState } from '@/src/social/push';
import {
  DEFAULT_REMINDERS,
  fmtReminderTime,
  loadReminders,
  type ReminderSettings,
  reminderStatus,
  saveReminders,
  setRestDay,
  shiftTime,
} from '@/src/social/reminders';
import { todayKey, useStore } from '@/src/store';
import { colors, fonts, radius, space } from '@/src/theme';

const PUSH_HELP: Record<PushState, string> = {
  on: 'On for this phone.',
  off: 'Not turned on for this phone yet.',
  denied: 'Blocked in iPhone Settings → Notifications → rep. Turn them on there, then come back.',
  'needs-home-screen': 'On iPhone, notifications only work once rep. is added to your Home Screen (Share → Add to Home Screen).',
  unsupported: 'This browser can’t show notifications. Use rep. from your Home Screen on iPhone.',
};

export default function Reminders() {
  const restDay = useStore((s) => s.restDay);
  const [r, setR] = useState<ReminderSettings | null>(null);
  const [push, setPush] = useState<PushState | null>(null);
  const [emailReady, setEmailReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadReminders()
      .then(setR)
      .catch((e) => {
        setR(DEFAULT_REMINDERS);
        setErr((e as Error).message);
      });
    pushState().then(setPush).catch(() => setPush('unsupported'));
    reminderStatus().then((s) => setEmailReady(s.email));
  }, []);

  const update = async (patch: Partial<ReminderSettings>) => {
    if (!r) return;
    const prev = r;
    setR({ ...r, ...patch });
    setErr(null);
    try {
      await saveReminders(patch);
    } catch (e) {
      setR(prev);
      setErr((e as Error).message);
    }
  };

  if (!r) {
    return (
      <Screen padTop={false}>
        <ActivityIndicator color={colors.latte} />
      </Screen>
    );
  }

  const restToday = restDay === todayKey();

  return (
    <Screen padTop={false} contentStyle={{ gap: space(5), paddingBottom: space(16) }}>
      <Body muted>
        If you haven’t logged a workout by your reminder time, rep. gives you a nudge. Logged one already, or taking a rest day? No reminder.
      </Body>

      <Card style={{ gap: space(3) }}>
        <Text style={label}>Remind me at</Text>
        <Row style={{ justifyContent: 'space-between' }}>
          <Stepper icon="remove" label="30 minutes earlier" onPress={() => update({ remindAt: shiftTime(r.remindAt, -30) })} />
          <Text style={{ fontFamily: fonts.display, fontSize: 40, color: colors.cream }} accessibilityLabel="Reminder time">
            {fmtReminderTime(r.remindAt)}
          </Text>
          <Stepper icon="add" label="30 minutes later" onPress={() => update({ remindAt: shiftTime(r.remindAt, 30) })} />
        </Row>
        <Body muted style={{ fontSize: 12, textAlign: 'center' }}>Your phone’s time zone is used automatically.</Body>
      </Card>

      <Card style={{ gap: space(3) }}>
        <Toggle title="Push notification" value={r.push} onChange={(push) => update({ push })} />
        {r.push && push ? (
          <View style={{ gap: space(2) }}>
            <Body muted style={{ fontSize: 13, color: push === 'on' ? colors.olive : colors.textMuted }}>
              {push === 'on' ? '✓ ' : ''}
              {PUSH_HELP[push]}
            </Body>
            {push === 'off' ? (
              <Button
                small
                variant="secondary"
                icon="notifications-outline"
                title="Turn on notifications for this phone"
                loading={busy}
                onPress={async () => {
                  setBusy(true);
                  setErr(null);
                  try {
                    await enablePush();
                    setPush(await pushState());
                  } catch (e) {
                    setErr((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            ) : null}
          </View>
        ) : null}
        <Divider />
        <Toggle
          title="Email"
          value={r.email && emailReady}
          disabled={!emailReady}
          onChange={(email) => update({ email })}
        />
        <Body muted style={{ fontSize: 13 }}>
          {emailReady ? 'Sent to the email you sign in with.' : 'Email reminders are coming soon — push works now.'}
        </Body>
      </Card>

      <Card style={{ gap: space(2) }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.cream }}>Rest day</Text>
        <Body muted style={{ fontSize: 13 }}>
          {restToday ? 'Today is a rest day — no reminder tonight. Recovery counts.' : 'Taking today off on purpose? Skip tonight’s reminder.'}
        </Body>
        <Button
          small
          variant={restToday ? 'ghost' : 'secondary'}
          icon={restToday ? 'arrow-undo-outline' : 'moon-outline'}
          title={restToday ? 'Undo rest day' : 'Rest day today'}
          onPress={() => setRestDay(!restToday).catch((e) => setErr((e as Error).message))}
        />
      </Card>

      {err ? <Body style={{ color: colors.sand, fontSize: 13 }}>{err}</Body> : null}
    </Screen>
  );
}

function Toggle({ title, value, onChange, disabled }: { title: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: disabled ? colors.textMuted : colors.cream }}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={title}
        trackColor={{ false: colors.bgRaised, true: colors.olive }}
        thumbColor={colors.cream}
        {...({ activeThumbColor: colors.cream } as object)}
      />
    </Row>
  );
}

function Stepper({ icon, label, onPress }: { icon: 'add' | 'remove'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={8}
      style={{ width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={20} color={colors.cream} />
    </Pressable>
  );
}

const label = { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.4 } as const;
