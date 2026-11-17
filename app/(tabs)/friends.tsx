import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Button, Card, Display, Empty, Eyebrow, H2, Icon, Italic, Row, Screen, SectionHeader } from '@/src/components/ui';
import { socialEnabled } from '@/src/config';
import { PushPrompt } from '@/src/social/PushPrompt';
import { Person } from '@/src/social/Person';
import {
  acceptFriend,
  type Challenge,
  type Friendship,
  listFriendships,
  myChallenges,
  removeFriendship,
} from '@/src/social/api';
import { todayKey, useStore } from '@/src/store';
import { colors, fonts, space } from '@/src/theme';

export default function Friends() {
  const account = useStore((s) => s.account);

  if (!socialEnabled()) {
    return (
      <Screen>
        <Header />
        <Empty icon="people-outline" title="Almost ready" text="Friends & challenges switch on once the rep. account server is connected." />
      </Screen>
    );
  }

  if (!account?.username) {
    return (
      <Screen>
        <Header />
        <Card tone="croc" style={{ marginTop: space(6), gap: space(3) }}>
          <Eyebrow>Accountability, but cute</Eyebrow>
          <H2>Add friends, start a challenge, keep each other going.</H2>
          <Body muted>
            Share workouts and steps with your group, follow the same plan, climb the leaderboard and get a ping when your
            friends finish a workout.
          </Body>
          <Button
            title={account ? 'Finish your profile' : 'Create an account'}
            style={{ marginTop: space(2) }}
            onPress={() => router.push('/account')}
          />
          {!account ? <Button title="I already have one — sign in" variant="ghost" small onPress={() => router.push('/account')} /> : null}
        </Card>
      </Screen>
    );
  }

  return <SignedInFriends />;
}

function Header() {
  return (
    <>
      <Eyebrow>Friends</Eyebrow>
      <Display style={{ marginTop: space(2) }}>
        Stronger <Italic>together.</Italic>
      </Display>
    </>
  );
}

function SignedInFriends() {
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [friends, setFriends] = useState<Friendship[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setErr(null);
    myChallenges().then(setChallenges).catch((e) => setErr((e as Error).message));
    listFriendships().then(setFriends).catch((e) => setErr((e as Error).message));
  }, []);
  useFocusEffect(load);

  const today = todayKey();
  const active = (challenges ?? []).filter((c) => c.ends_on >= today);
  const past = (challenges ?? []).filter((c) => c.ends_on < today);
  const incoming = (friends ?? []).filter((f) => f.status === 'pending' && f.incoming);
  const outgoing = (friends ?? []).filter((f) => f.status === 'pending' && !f.incoming);
  const accepted = (friends ?? []).filter((f) => f.status === 'accepted');

  return (
    <Screen>
      <Header />
      <PushPrompt />
      {err ? (
        <Card style={{ marginTop: space(4) }}>
          <Body style={{ color: colors.sand, fontSize: 14 }}>{err}</Body>
          <Button title="Try again" small variant="secondary" style={{ marginTop: space(3) }} onPress={load} />
        </Card>
      ) : null}

      <SectionHeader title="Challenges" action="Join with code" onAction={() => router.push('/join')} />
      {challenges === null ? (
        <Body muted>Loading…</Body>
      ) : active.length === 0 ? (
        <Empty icon="trophy-outline" title="No challenge yet" text="Start one with friends — pick the length, how points work and an optional shared plan.">
          <Button title="New challenge" icon="add" onPress={() => router.push('/challenge-new')} />
        </Empty>
      ) : (
        <View style={{ gap: space(3) }}>
          {active.map((c, i) => (
            <ChallengeCard key={c.id} c={c} tone={i % 2 ? 'satin' : 'croc'} />
          ))}
          <Button title="New challenge" icon="add" variant="secondary" onPress={() => router.push('/challenge-new')} />
        </View>
      )}

      {incoming.length ? (
        <>
          <SectionHeader title="Friend requests" />
          <Card style={{ gap: space(1) }}>
            {incoming.map((f) => (
              <Row key={f.requester} style={{ justifyContent: 'space-between', paddingVertical: space(2) }}>
                <Person name={f.other.display_name} username={f.other.username} />
                <Row gap={2}>
                  <Button small title="Accept" onPress={() => acceptFriend(f.requester).then(load).catch((e) => setErr(e.message))} />
                  <Pressable hitSlop={10} onPress={() => removeFriendship(f).then(load).catch((e) => setErr(e.message))}>
                    <Icon name="close" size={18} color={colors.textFaint} />
                  </Pressable>
                </Row>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Friends" action="+ Add friend" onAction={() => router.push('/add-friend')} />
      {friends === null ? (
        <Body muted>Loading…</Body>
      ) : accepted.length === 0 && outgoing.length === 0 ? (
        <Empty icon="person-add-outline" title="No friends yet" text="Find friends by their @username.">
          <Button title="Add a friend" icon="person-add-outline" variant="secondary" onPress={() => router.push('/add-friend')} />
        </Empty>
      ) : (
        <Card style={{ gap: space(1) }}>
          {accepted.map((f) => (
            <Row key={f.other.id} style={{ justifyContent: 'space-between', paddingVertical: space(2) }}>
              <Person name={f.other.display_name} username={f.other.username} />
            </Row>
          ))}
          {outgoing.map((f) => (
            <Row key={f.other.id} style={{ justifyContent: 'space-between', paddingVertical: space(2) }}>
              <Person name={f.other.display_name} username={f.other.username} />
              <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textFaint }}>Requested</Text>
            </Row>
          ))}
        </Card>
      )}

      {past.length ? (
        <>
          <SectionHeader title="Finished challenges" />
          <View style={{ gap: space(3) }}>
            {past.map((c) => (
              <ChallengeCard key={c.id} c={c} tone="default" />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function ChallengeCard({ c, tone }: { c: Challenge; tone: 'croc' | 'satin' | 'default' }) {
  const today = todayKey();
  const daysLeft = Math.round((+new Date(c.ends_on + 'T12:00') - +new Date(today + 'T12:00')) / 86400000);
  const notStarted = c.starts_on > today;
  return (
    <Card tone={tone} onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: c.id } })}>
      <Eyebrow color={colors.latte}>
        {daysLeft < 0 ? 'Finished' : notStarted ? `Starts ${new Date(c.starts_on + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}` : daysLeft === 0 ? 'Last day' : `${daysLeft} days left`}
      </Eyebrow>
      <H2 style={{ marginTop: space(1) }}>{c.name}</H2>
      <Body muted style={{ fontSize: 13 }}>
        {[c.score_workouts && 'Workouts', c.score_steps && 'Steps', c.score_streaks && 'Streaks', c.score_plan && c.plan.length && 'Plan']
          .filter(Boolean)
          .join(' · ')}
      </Body>
    </Card>
  );
}
