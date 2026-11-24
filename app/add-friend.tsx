import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Body, Button, Field, Screen } from '@/src/components/ui';
import { listFriendships, type Profile, searchUsers, sendFriendRequest } from '@/src/social/api';
import { colors, fonts, space } from '@/src/theme';
import { Person } from '@/src/social/Person';

export default function AddFriend() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [status, setStatus] = useState<Record<string, 'friends' | 'pending'>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listFriendships()
      .then((fs) => setStatus(Object.fromEntries(fs.map((f) => [f.other.id, f.status === 'accepted' ? 'friends' : 'pending']))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      searchUsers(q)
        .then(setResults)
        .catch((e) => setErr((e as Error).message));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const add = async (p: Profile) => {
    setErr(null);
    try {
      await sendFriendRequest(p.id);
      setStatus((s) => ({ ...s, [p.id]: 'pending' }));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <Screen padTop={false} contentStyle={{ gap: space(4) }}>
      <Field value={q} onChangeText={setQ} placeholder="Search @username or name" autoCapitalize="none" autoCorrect={false} autoFocus />
      {err ? <Body style={{ color: colors.sand, fontSize: 14 }}>{err}</Body> : null}
      {q.trim().length >= 2 && results.length === 0 ? (
        <Body muted>No one found. Check the spelling, or send them your invite link instead.</Body>
      ) : null}
      <View>
        {results.map((p) => (
          <View key={p.id} style={{ paddingVertical: space(3), borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Person
              name={p.display_name}
              username={p.username}
              right={
                status[p.id] ? (
                  <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textMuted }}>
                    {status[p.id] === 'friends' ? 'Friends ✓' : 'Requested'}
                  </Text>
                ) : (
                  <Button small title="Add" onPress={() => add(p)} />
                )
              }
            />
          </View>
        ))}
      </View>
    </Screen>
  );
}
