import { Text, View } from 'react-native';
import { Row } from '../components/ui';
import { colors, fonts } from '../theme';

/** Avatar initial + name + @username row. */
export function Person({ name, username, right }: { name: string; username: string; right?: React.ReactNode }) {
  return (
    <Row gap={3} style={{ flex: 1 }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: colors.burgundy,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.cream }}>{(name || username).slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.cream }} numberOfLines={1}>
          {name || username}
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textFaint }}>@{username}</Text>
      </View>
      {right}
    </Row>
  );
}
