import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Display, Eyebrow, H2, Icon, Italic, Row, tap } from '@/src/components/ui';
import { askCoach, generatePlan } from '@/src/coach';
import { useStore } from '@/src/store';
import { isCoachConfigured } from '@/src/api';
import { router } from 'expo-router';
import { colors, fonts, gradients, radius, space } from '@/src/theme';

const PROMPTS = [
  'What should I train today based on my recovery?',
  'Give me 3 new glute exercises to rotate in',
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
  const configured = isCoachConfigured(s.server);
  if (!configured || s.coachStatus === 'unauthorized') {
    return <CoachNotSetUp insetTop={insets.top} wrongPassword={configured} />;
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
                    {r.exercises.length ? <Text style={styles.recEx}>{r.exercises.join(' · ')}</Text> : null}
                  </View>
                ))}
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

/** Shown until a coach link + password are saved (or when the password stops working). */
function CoachNotSetUp({ insetTop, wrongPassword }: { insetTop: number; wrongPassword: boolean }) {
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
            <Eyebrow color={colors.latte}>{wrongPassword ? 'Coach locked' : 'Coach not set up'}</Eyebrow>
          </Row>
          <H2>{wrongPassword ? 'That coach password isn’t working' : 'Your AI coach needs a password'}</H2>
          <Body muted>
            {wrongPassword
              ? 'The coach password saved on this phone was rejected. It may have been changed — ask for the new one, then update it in You → Coach.'
              : 'The coach is invite-only. If someone shared rep. with you, ask them for the coach link and coach password. Then add them in You → Coach.'}
          </Body>
          <Body muted style={{ fontSize: 13 }}>
            Everything else — workouts, PRs, weigh-ins and goals — works without it.
          </Body>
          <Button title="Go to coach settings" icon="arrow-forward" style={{ marginTop: space(2) }} onPress={() => router.push('/you')} />
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
