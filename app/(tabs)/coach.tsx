import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useRef, useState } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Display, Eyebrow, H2, Icon, Italic, Row, tap } from '@/src/components/ui';
import { askCoach, generatePlan } from '@/src/coach';
import { useStore } from '@/src/store';
import { exerciseLabel, saveToCoachFolder, startPlannedWorkout, toPlanned } from '@/src/splits';
import { checkCoachAccess, type CoachAccess, isCoachConfigured, usesAccountForCoach } from '@/src/api';
import { router, useFocusEffect } from 'expo-router';
import { colors, fonts, gradients, radius, space } from '@/src/theme';

const PROMPTS = [
  'Help me set a target for my goals',
  'What should I train today based on my recovery?',
  'Suggest 3 new exercises to rotate in',
  'Am I progressing on my lifts?',
  'Should I raise my step goal?',
  'Build me a 4-day split for my goals',
];

export default function Coach() {
  const s = useStore();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedRecs, setSavedRecs] = useState<string[]>([]);
  const [access, setAccess] = useState<CoachAccess | 'checking'>('checking');
  const signedIn = usesAccountForCoach();

  // Signed-in users: ask the server whether this account has coach access (re-checked each visit).
  useFocusEffect(
    useCallback(() => {
      if (!usesAccountForCoach()) return;
      checkCoachAccess().then((a) => {
        setAccess(a);
        if (a === 'enabled' && useStore.getState().coachStatus === 'no_access') useStore.getState().set({ coachStatus: undefined });
      });
    }, []),
  );

  const send = async (msg: string) => {
    const m = msg.trim();
    if (!m || sending) return;
    setError(null);
    setText('');
    s.addCoachMessage({ role: 'user', text: m });
    setSending(true);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    try {
      const reply = await askCoach(m);
      useStore.getState().addCoachMessage({ role: 'assistant', text: reply });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const refreshPlan = async () => {
    setError(null);
    setPlanning(true);
    try {
      s.set({ plan: await generatePlan() });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPlanning(false);
    }
  };

  const plan = s.plan;
  if (signedIn) {
    if (access === 'no_access' || s.coachStatus === 'no_access') {
      return <CoachNotSetUp insetTop={insets.top} variant="no_access" username={s.account?.username} />;
    }
    if (access === 'signed_out') return <CoachNotSetUp insetTop={insets.top} variant="session_expired" />;
  } else {
    const configured = isCoachConfigured(s.server);
    if (!configured) return <CoachNotSetUp insetTop={insets.top} variant="signed_out" />;
    if (s.coachStatus === 'unauthorized') return <CoachNotSetUp insetTop={insets.top} variant="wrong_password" />;
  }

  return (
    <LinearGradient colors={gradients.screen} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={{ paddingTop: insets.top + space(4), paddingHorizontal: space(5), paddingBottom: space(6) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Eyebrow>Your coach</Eyebrow>
          <Display style={{ marginTop: space(2) }}>
            Trainer in <Italic>your pocket.</Italic>
          </Display>

          {/* Plan */}
          <Card tone="satin" style={{ marginTop: space(6) }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={2}>
                <Icon name="sparkles" size={15} color={colors.latte} />
                <Eyebrow color={colors.latte}>This week’s plan</Eyebrow>
              </Row>
              {plan ? (
                <Text style={styles.small}>
                  {new Date(plan.generatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              ) : null}
            </Row>
            {plan ? (
              <View style={{ gap: space(3), marginTop: space(3) }}>
                <H2>{plan.headline}</H2>
                <Body muted>{plan.focus}</Body>

                <View style={styles.stepBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.small}>Suggested step goal</Text>
                    <Text style={styles.stepNum}>{plan.stepGoal.toLocaleString()}</Text>
                  </View>
                  {plan.stepGoal !== s.profile.stepGoal ? (
                    <Button small title="Use it" variant="secondary" onPress={() => s.updateProfile({ stepGoal: plan.stepGoal })} />
                  ) : (
                    <Text style={[styles.small, { color: colors.latte }]}>Active ✓</Text>
                  )}
                </View>

                {plan.recommendations.map((r, i) => (
                  <View key={i} style={styles.rec}>
                    <Text style={styles.recTitle}>{r.title}</Text>
                    <Text style={styles.recWhy}>{r.why}</Text>
                    {r.exercises.length ? (
                      <>
                        <Text style={styles.recEx}>{r.exercises.map(exerciseLabel).join(' · ')}</Text>
                        <Row gap={2} style={{ marginTop: space(2) }}>
                          <Button
                            small
                            title="Start"
                            icon="play"
                            onPress={() => router.push(`/workout/${startPlannedWorkout(r.title, r.exercises.map(toPlanned))}`)}
                          />
                          <Button
                            small
                            variant="secondary"
                            title={savedRecs.includes(r.title) ? 'Saved ✓' : 'Save to my workouts'}
                            disabled={savedRecs.includes(r.title)}
                            onPress={() => {
                              saveToCoachFolder(r.title, r.exercises.map(toPlanned));
                              setSavedRecs((x) => [...x, r.title]);
                            }}
                          />
                        </Row>
                      </>
                    ) : null}
                  </View>
                ))}
                {plan.suggestedTargets?.length ? (
                  <View style={styles.rec}>
                    <Text style={styles.recTitle}>Suggested targets</Text>
                    {plan.suggestedTargets.map((t, k) => (
                      <View key={k} style={{ marginTop: space(2), gap: space(1) }}>
                        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.cream }}>
                          {t.title} · {t.weeks} week{t.weeks === 1 ? '' : 's'}
                        </Text>
                        <Text style={styles.recWhy}>{t.why}</Text>
                        <Button
                          small
                          variant="secondary"
                          icon="flag-outline"
                          title="Add target"
                          onPress={() =>
                            router.push({
                              pathname: '/target-new',
                              params: { kind: t.kind, title: t.title, exercise: t.exercise ?? '', value: String(t.target_value), weeks: String(t.weeks) },
                            })
                          }
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={styles.rec}>
                  <Text style={styles.recTitle}>Recovery</Text>
                  <Text style={styles.recWhy}>{plan.recovery}</Text>
                </View>
              </View>
            ) : (
              <Body muted style={{ marginTop: space(3) }}>
                Your coach reads your goals, workouts, weigh-ins, steps, sleep and readiness to build a plan just for you.
              </Body>
            )}
            <Button
              title={plan ? 'Refresh plan' : 'Build my plan'}
              icon="sparkles"
              loading={planning}
              style={{ marginTop: space(5) }}
              onPress={refreshPlan}
            />
          </Card>

          {/* Chat */}
          <Row style={{ justifyContent: 'space-between', marginTop: space(8), marginBottom: space(3) }}>
            <H2>Ask anything</H2>
            {s.coach.length ? (
              <Pressable onPress={s.clearCoach} hitSlop={10}>
                <Text style={[styles.small, { color: colors.latte }]}>Clear</Text>
              </Pressable>
            ) : null}
          </Row>

          {s.coach.length === 0 ? (
            <View style={{ gap: space(2) }}>
              {PROMPTS.map((p) => (
                <Pressable key={p} onPress={() => { tap(); send(p); }} style={styles.prompt}>
                  <Text style={styles.promptText}>{p}</Text>
                  <Icon name="arrow-forward" size={14} color={colors.textFaint} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={{ gap: space(3) }}>
              {s.coach.map((m) => (
                <View key={m.id} style={[styles.bubble, m.role === 'user' ? styles.user : styles.assistant]}>
                  <Text style={[styles.bubbleText, m.role === 'user' && { color: colors.cream }]}>{m.text}</Text>
                </View>
              ))}
              {sending ? (
                <View style={[styles.bubble, styles.assistant, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                  <ActivityIndicator color={colors.latte} size="small" />
                  <Text style={styles.small}>Thinking…</Text>
                </View>
              ) : null}
            </View>
          )}

          {error ? (
            <Card style={{ marginTop: space(4), borderColor: 'rgba(196,106,94,0.4)' }}>
              <Body style={{ color: colors.sand, fontSize: 14 }}>{error}</Body>
            </Card>
          ) : null}
        </ScrollView>

        {/* Composer */}
        <View style={[styles.composer, { marginBottom: Platform.OS === 'ios' ? 92 : 72 }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message your coach…"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            multiline={Platform.OS !== 'web'}
            onSubmitEditing={() => send(text)}
            blurOnSubmit={false}
          />
          <Pressable onPress={() => send(text)} disabled={!text.trim() || sending} style={[styles.send, (!text.trim() || sending) && { opacity: 0.4 }]}>
            <Icon name="arrow-up" size={18} color={colors.bg} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

type Locked = 'signed_out' | 'session_expired' | 'no_access' | 'wrong_password';

const LOCKED: Record<Locked, { eyebrow: string; title: string; body: string; cta: string; to: '/account' | '/you' }> = {
  signed_out: {
    eyebrow: 'Coach not set up',
    title: 'Sign in to use your coach',
    body: 'The AI coach is invite-only and works through your rep. account. Sign in, then ask whoever shared rep. with you to switch on coach access.',
    cta: 'Sign in or create an account',
    to: '/account',
  },
  session_expired: {
    eyebrow: 'Signed out',
    title: 'Sign in again',
    body: 'Your sign-in expired on this device. Sign in again to keep using the coach.',
    cta: 'Sign in',
    to: '/account',
  },
  no_access: {
    eyebrow: 'Invite-only',
    title: 'Ask for coach access',
    body: 'Your account doesn’t have the AI coach switched on yet. To keep costs in check it’s invite-only — ask the person who shared rep. with you to turn it on.',
    cta: 'View my account',
    to: '/account',
  },
  wrong_password: {
    eyebrow: 'Coach locked',
    title: 'That coach password isn’t working',
    body: 'The coach password saved on this phone was rejected — it may have been changed. Signing in with a rep. account is the easier way in.',
    cta: 'Go to coach settings',
    to: '/you',
  },
};

/** Shown when the coach isn't available to this person yet. */
function CoachNotSetUp({ insetTop, variant, username }: { insetTop: number; variant: Locked; username?: string }) {
  const v = LOCKED[variant];
  return (
    <LinearGradient colors={gradients.screen} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insetTop + space(4), paddingHorizontal: space(5), paddingBottom: space(28) }}>
        <Eyebrow>Your coach</Eyebrow>
        <Display style={{ marginTop: space(2) }}>
          Trainer in <Italic>your pocket.</Italic>
        </Display>
        <Card tone="satin" style={{ marginTop: space(6), gap: space(3) }}>
          <Row gap={2}>
            <Icon name="lock-closed-outline" size={15} color={colors.latte} />
            <Eyebrow color={colors.latte}>{v.eyebrow}</Eyebrow>
          </Row>
          <H2>{v.title}</H2>
          <Body muted>{v.body}</Body>
          {variant === 'no_access' && username ? (
            <Body style={{ fontSize: 14 }}>
              Tell them your username: <Text style={{ fontFamily: fonts.bodyBold, color: colors.cream }}>@{username}</Text>
            </Body>
          ) : null}
          <Body muted style={{ fontSize: 13 }}>Everything else — workouts, PRs, weigh-ins, goals and challenges — works without it.</Body>
          <Button title={v.cta} icon="arrow-forward" style={{ marginTop: space(2) }} onPress={() => router.push(v.to)} />
          {variant === 'signed_out' ? (
            <Button title="I have a coach password instead" variant="ghost" small onPress={() => router.push('/you')} />
          ) : null}
        </Card>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  stepBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: radius.md,
    padding: space(4),
  },
  stepNum: { fontFamily: fonts.display, fontSize: 28, color: colors.cream },
  rec: { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: radius.md, padding: space(4), gap: space(1) },
  recTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.cream },
  recWhy: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  recEx: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.latte, marginTop: space(1) },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space(4),
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  promptText: { fontFamily: fonts.body, fontSize: 14, color: colors.text, flex: 1, marginRight: space(2) },
  bubble: { padding: space(4), borderRadius: radius.lg, maxWidth: '88%' },
  user: { alignSelf: 'flex-end', backgroundColor: colors.burgundy, borderBottomRightRadius: 6 },
  assistant: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space(2),
    marginHorizontal: space(4),
    padding: space(2),
    paddingLeft: space(4),
    borderRadius: radius.xl,
    backgroundColor: colors.bgRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  input: { flex: 1, color: colors.cream, fontFamily: fonts.body, fontSize: 15, maxHeight: 120, paddingVertical: space(2.5), outlineStyle: 'none' as never },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.latte, alignItems: 'center', justifyContent: 'center' },
});
