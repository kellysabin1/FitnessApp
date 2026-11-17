import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { Body, Button, Card, Divider, Empty, Eyebrow, H2, Icon, Row, Screen, SectionHeader, tap } from '@/src/components/ui';
import {
  addFriendToChallenge,
  type Challenge,
  feed as loadFeed,
  type FeedItem,
  leaderboard as loadBoard,
  type LeaderRow,
  leaveChallenge,
  deleteChallenge,
  listFriendships,
  nudge,
  type Profile,
  REACTIONS,
  toggleReaction,
  getChallenge,
} from '@/src/social/api';
import { notifyActivity } from '@/src/social/push';
import { Person } from '@/src/social/Person';
import { shareInvite } from '@/src/social/share';
import { healthForDate, todayKey, useStore } from '@/src/store';
import { colors, fonts, radius, space } from '@/src/theme';
import { addExercisesByName } from '@/src/workoutActions';

export default function ChallengeScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const me = useStore((s) => s.account?.userId);
  const workouts = useStore((s) => s.workouts);
  const health = useStore((s) => s.health);
  const startWorkout = useStore((s) => s.startWorkout);
  const [c, setC] = useState<Challenge | null | undefined>(undefined);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(fresh ? 'Challenge created — invite your friends below ✨' : null);
  const [err, setErr] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    getChallenge(id)
      .then(setC)
      .catch((e) => setErr((e as Error).message));
    loadBoard(id).then(setBoard).catch(() => {});
    loadFeed(id).then(setItems).catch(() => {});
  }, [id]);
  useFocusEffect(load);

  if (c === undefined) return <Screen padTop={false}>{err ? <Body style={{ color: colors.sand }}>{err}</Body> : <Body muted>Loading…</Body>}</Screen>;
  if (c === null) return <Screen padTop={false}><Body muted>This challenge doesn’t exist, or you’re no longer in it.</Body></Screen>;

  const today = todayKey();
  const dayNum = Math.floor((+new Date(today + 'T12:00') - +new Date(c.starts_on + 'T12:00')) / 86400000) + 1;
  const totalDays = Math.floor((+new Date(c.ends_on + 'T12:00') - +new Date(c.starts_on + 'T12:00')) / 86400000) + 1;
  const status = today < c.starts_on ? 'Starts soon' : today > c.ends_on ? 'Finished' : `Day ${dayNum} of ${totalDays}`;
  const running = today >= c.starts_on && today <= c.ends_on;
  const memberIds = new Set(board.map((r) => r.user_id));
  const mySteps = healthForDate(health, today).steps;

  const donePlan = (title: string) =>
    workouts.some((w) => w.finishedAt && w.planItem === title && todayKey(new Date(w.startedAt)) >= c.starts_on && todayKey(new Date(w.startedAt)) <= c.ends_on);

  const startPlan = (title: string, exercises: string[]) => {
    const wid = startWorkout(title, title);
    addExercisesByName(wid, exercises);
    router.push(`/workout/${wid}`);
  };

  const invite = async () => {
    const r = await shareInvite(c.invite_code, c.name);
    if (r === 'copied') setToast('Invite copied — paste it in a text ✨');
  };

  const openAdd = async () => {
    setShowAdd((v) => !v);
    if (!friends.length) {
      const fs = await listFriendships().catch(() => []);
      setFriends(fs.filter((f) => f.status === 'accepted').map((f) => f.other));
    }
  };

  const poke = async (to?: string) => {
    try {
      const aid = await nudge(c.id, to);
      notifyActivity([aid]);
      setToast(to ? 'Nudge sent 👋' : 'Nudged the whole group 👋');
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const leave = () => {
    const go = () => leaveChallenge(c.id).then(() => router.back()).catch((e) => setErr(e.message));
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (confirm(`Leave “${c.name}”?`)) go();
    } else Alert.alert('Leave challenge?', c.name, [{ text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: go }]);
  };

  const isCreator = c.created_by === me;
  const remove = () => {
    const go = () => deleteChallenge(c.id).then(() => router.back()).catch((e) => setErr(e.message));
    const others = Math.max(0, board.length - 1);
    const msg = `This deletes “${c.name}” for everyone${others ? ` (${others} other member${others > 1 ? 's' : ''})` : ''}, including the leaderboard and feed. Everyone keeps their own workouts.`;
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (confirm(`${msg}\n\nDelete challenge?`)) go();
    } else Alert.alert('Delete challenge?', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  };

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <Screen padTop={false}>
        <Eyebrow>{status}</Eyebrow>
        <H2 style={{ fontSize: 34, marginTop: space(1) }}>{c.name}</H2>
        <Body muted style={{ fontSize: 13 }}>
          {c.mode === 'plan' ? 'Group plan challenge · only plan workouts count' : 'Any workout counts'}
        </Body>
        {c.description ? <Body style={{ fontSize: 15, marginTop: space(3) }}>{c.description}</Body> : null}
        {toast ? <Body style={{ color: colors.latte, fontSize: 14, marginTop: space(2) }}>{toast}</Body> : null}
        {err ? <Body style={{ color: colors.sand, fontSize: 14, marginTop: space(2) }}>{err}</Body> : null}

        {/* Invite */}
        <Card tone="croc" style={{ marginTop: space(5) }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Eyebrow color={colors.latte}>Invite code</Eyebrow>
              <Text style={{ fontFamily: fonts.display, fontSize: 34, color: colors.cream, letterSpacing: 4 }}>{c.invite_code}</Text>
            </View>
            <Button small title="Share invite" icon="share-outline" onPress={invite} />
          </Row>
          <Pressable onPress={openAdd} style={{ marginTop: space(3) }} hitSlop={8}>
            <Text style={{ fontFamily: fonts.bodyMedium, color: colors.latte, fontSize: 13 }}>
              {showAdd ? 'Hide friends' : '+ Add a friend directly'}
            </Text>
          </Pressable>
          {showAdd ? (
            <View style={{ marginTop: space(2) }}>
              {friends.filter((f) => !memberIds.has(f.id)).length === 0 ? (
                <Body muted style={{ fontSize: 13 }}>All your friends are already in — or add friends from the Friends tab first.</Body>
              ) : (
                friends
                  .filter((f) => !memberIds.has(f.id))
                  .map((f) => (
                    <View key={f.id} style={{ paddingVertical: space(2) }}>
                      <Person
                        name={f.display_name}
                        username={f.username}
                        right={
                          <Button
                            small
                            title="Add"
                            onPress={() =>
                              addFriendToChallenge(c.id, f.id)
                                .then(load)
                                .catch((e) => setErr(e.message))
                            }
                          />
                        }
                      />
                    </View>
                  ))
              )}
            </View>
          ) : null}
        </Card>

        {/* Leaderboard */}
        <Row style={{ justifyContent: 'space-between', marginTop: space(7), marginBottom: space(3) }}>
          <Row gap={2}>
            <H2>Leaderboard</H2>
            <Pressable onPress={() => setShowRules((v) => !v)} hitSlop={10} accessibilityLabel="How scoring works">
              <Icon name="information-circle-outline" size={20} color={colors.latte} />
            </Pressable>
          </Row>
          {running && board.length > 1 ? (
            <Pressable onPress={() => poke()} hitSlop={10}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.latte }}>Nudge everyone</Text>
            </Pressable>
          ) : null}
        </Row>
        {showRules ? <ScoringRules c={c} /> : null}
        <Card style={{ paddingVertical: space(2) }}>
          {board.map((r, i) => (
            <View key={r.user_id} style={{ paddingVertical: space(3), borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
              <Row gap={3}>
                <Text style={{ width: 22, fontFamily: fonts.display, fontSize: 22, color: i === 0 ? colors.brass : colors.textMuted }}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Person
                    name={r.user_id === me ? `${r.display_name || r.username} (you)` : r.display_name}
                    username={r.username}
                    right={
                      <Pressable
                        onPress={() => setOpenRow((o) => (o === r.user_id ? null : r.user_id))}
                        hitSlop={8}
                        accessibilityLabel={`${r.points} points — show breakdown`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      >
                        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.cream }}>
                          {r.points}
                          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textMuted }}> pts</Text>
                        </Text>
                        <Icon name={openRow === r.user_id ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
                      </Pressable>
                    }
                  />
                </View>
              </Row>
              {openRow === r.user_id ? <Breakdown r={r} c={c} /> : null}
              <Row gap={2} style={{ marginTop: space(2), marginLeft: 22 + space(3), flexWrap: 'wrap' }}>
                {c.score_workouts ? <Stat label={`${r.workouts} ${c.mode === 'plan' ? 'plan workouts' : 'workouts'}`} /> : null}
                {c.score_steps ? <Stat label={`${Number(r.steps).toLocaleString()} steps`} /> : null}
                {c.score_streaks ? <Stat label={`${r.current_streak}-day streak`} /> : null}
                {c.mode !== 'plan' && c.score_plan && c.plan.length ? <Stat label={`${r.plan_done} plan`} /> : null}
                {running && r.user_id !== me ? (
                  <Pressable onPress={() => poke(r.user_id)} hitSlop={8}>
                    <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.latte }}>Nudge 👋</Text>
                  </Pressable>
                ) : null}
              </Row>
            </View>
          ))}
        </Card>

        {/* Steps */}
        {c.score_steps && running ? (
          <>
            <SectionHeader title="Today’s steps" />
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.cream }}>
                    {mySteps != null ? mySteps.toLocaleString() : '—'}
                  </Text>
                  <Body muted style={{ fontSize: 13 }}>Goal {c.step_goal.toLocaleString()}</Body>
                </View>
                <Button small variant="secondary" title={mySteps != null ? 'Update' : 'Log steps'} onPress={() => router.push('/log-steps')} />
              </Row>
            </Card>
          </>
        ) : null}

        {/* Shared plan */}
        {c.plan.length ? (
          <>
            <SectionHeader title={c.mode === 'plan' ? 'The plan · only these count' : 'Group plan · +5 bonus'} />
            <View style={{ gap: space(3) }}>
              {c.plan.map((p) => {
                const done = donePlan(p.title);
                return (
                  <Card key={p.title} tone={done ? 'default' : 'satin'}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <View style={{ flex: 1, marginRight: space(3) }}>
                        <H2 style={{ fontSize: 20 }}>{p.title}</H2>
                        <Body muted numberOfLines={1} style={{ fontSize: 13 }}>{p.exercises.join(' · ')}</Body>
                      </View>
                      {done ? (
                        <Row gap={1}>
                          <Icon name="checkmark-circle" color={colors.olive} />
                          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted }}>Done</Text>
                        </Row>
                      ) : running ? (
                        <Button small title="Start" onPress={() => startPlan(p.title, p.exercises)} />
                      ) : null}
                    </Row>
                  </Card>
                );
              })}
            </View>
          </>
        ) : null}

        {/* Feed */}
        <SectionHeader title="Activity" />
        {items.length === 0 ? (
          <Empty icon="sparkles-outline" title="Quiet so far" text="Finished workouts show up here for everyone in the challenge." />
        ) : (
          <View style={{ gap: space(3) }}>
            {items.map((it) => (
              <FeedCard key={it.id} it={it} me={me!} board={board} onChanged={load} />
            ))}
          </View>
        )}

        <Divider />
        {isCreator ? (
          <Button title="Delete challenge" icon="trash-outline" variant="danger" small onPress={remove} />
        ) : (
          <Button title="Leave challenge" variant="ghost" small onPress={leave} />
        )}
      </Screen>
    </>
  );
}

/** Where someone's points came from — always sums to their total (computed in the database). */
function Breakdown({ r, c }: { r: LeaderRow; c: Challenge }) {
  const planOnly = c.mode === 'plan';
  const rows = [
    c.score_workouts && { label: planOnly ? 'Plan workouts' : 'Workouts', detail: `${r.workouts} × 10`, pts: r.pts_workouts },
    c.score_steps && {
      label: 'Steps',
      detail: `${Number(r.steps).toLocaleString()} steps${r.goal_days ? ` · goal hit ${r.goal_days}×` : ''}`,
      pts: r.pts_steps,
    },
    c.score_streaks && { label: 'Streaks', detail: `${r.streak_days} streak day${r.streak_days === 1 ? '' : 's'} × 3`, pts: r.pts_streaks },
    !planOnly && c.score_plan && c.plan.length > 0 && { label: 'Plan bonus', detail: `${r.plan_done} × 5`, pts: r.pts_plan },
  ].filter(Boolean) as { label: string; detail: string; pts: number }[];
  return (
    <View style={{ marginTop: space(3), marginLeft: 22 + space(3), padding: space(3), borderRadius: radius.md, backgroundColor: colors.bgRaised, gap: space(2) }}>
      {rows.map((x) => (
        <Row key={x.label} style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.cream }}>{x.label}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textFaint }}>{x.detail}</Text>
          </View>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.cream }}>{x.pts}</Text>
        </Row>
      ))}
      <Divider />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted }}>Total</Text>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.cream }}>{r.points}</Text>
      </Row>
    </View>
  );
}

/** Plain-language scoring rules for this challenge's settings. */
function ScoringRules({ c }: { c: Challenge }) {
  const planOnly = c.mode === 'plan';
  const lines = [
    c.score_workouts && `${planOnly ? 'Each plan workout' : 'Each workout'} = 10 points (up to 2 a day).`,
    c.score_steps && `Every 1,000 steps = 1 point (up to 20 a day), plus 5 bonus points on days you reach ${c.step_goal.toLocaleString()} steps.`,
    c.score_streaks &&
      `Streaks: 3 points for each active day in a row after the first. Active = ${planOnly ? 'a plan workout' : 'a workout'}${c.score_steps ? ' or hitting the step goal' : ''}.`,
    !planOnly && c.score_plan && c.plan.length > 0 && 'Group plan bonus: +5 for each workout from the plan.',
    planOnly && 'Only workouts from the group plan count toward points.',
  ].filter(Boolean) as string[];
  return (
    <Card style={{ marginBottom: space(3), gap: space(2) }}>
      <Eyebrow>How scoring works</Eyebrow>
      {lines.map((l) => (
        <Body key={l} muted style={{ fontSize: 13 }}>
          • {l}
        </Body>
      ))}
    </Card>
  );
}

function Stat({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: space(2.5), paddingVertical: space(1), borderRadius: radius.pill, backgroundColor: colors.bgRaised }}>
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textMuted }}>{label}</Text>
    </View>
  );
}

function FeedCard({ it, me, board, onChanged }: { it: FeedItem; me: string; board: LeaderRow[]; onChanged: () => void }) {
  const who = it.who?.display_name || it.who?.username || 'Someone';
  const nameOf = (uid: string) => {
    const r = board.find((b) => b.user_id === uid);
    return uid === me ? 'you' : r?.display_name || r?.username || 'someone';
  };
  const text =
    it.kind === 'workout'
      ? `${who} ${it.payload.logged ? 'logged' : 'finished'} ${it.payload.title ?? 'a workout'}${it.payload.duration_min ? ` · ${it.payload.duration_min} min` : ''}`
      : it.kind === 'joined'
        ? `${who} joined the challenge`
        : it.kind === 'created'
          ? `${who} started the challenge`
          : it.kind === 'nudge'
            ? it.payload.to
              ? `${who} nudged ${nameOf(it.payload.to)} 👋`
              : `${who} nudged everyone 👋`
            : `${who} logged steps`;

  const counts = REACTIONS.map((e) => ({
    e,
    n: it.reactions.filter((r) => r.emoji === e).length,
    mine: it.reactions.some((r) => r.emoji === e && r.user_id === me),
  }));

  return (
    <Card style={{ padding: space(4) }}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.cream }}>{text}</Text>
      {it.payload.plan_item ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.latte, marginTop: 2 }}>✓ Group plan</Text>
      ) : null}
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
        {new Date(it.created_at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
      </Text>
      {it.kind === 'workout' ? (
        <Row gap={2} style={{ marginTop: space(3), flexWrap: 'wrap' }}>
          {counts.map(({ e, n, mine }) => (
            <Pressable
              key={e}
              onPress={() => {
                tap();
                toggleReaction(it, e).then(onChanged).catch(() => {});
              }}
              style={{
                paddingHorizontal: space(3),
                paddingVertical: space(1.5),
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: mine ? 'rgba(216,193,166,0.45)' : colors.line,
                backgroundColor: mine ? colors.burgundy : colors.bgRaised,
              }}
            >
              <Text style={{ fontSize: 14, color: colors.cream }}>
                {e}
                {n ? ` ${n}` : ''}
              </Text>
            </Pressable>
          ))}
        </Row>
      ) : null}
    </Card>
  );
}

