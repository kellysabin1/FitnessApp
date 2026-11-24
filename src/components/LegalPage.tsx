import { Text, View } from 'react-native';
import { type LegalSection, LEGAL_UPDATED } from '../legal';
import { colors, fonts, space } from '../theme';
import { Body, Screen } from './ui';

export function LegalPage({ sections }: { sections: LegalSection[] }) {
  return (
    <Screen padTop={false} contentStyle={{ gap: space(6), paddingBottom: space(16) }}>
      <Body muted style={{ fontSize: 12 }}>
        Last updated {LEGAL_UPDATED}
      </Body>
      {sections.map((s) => (
        <View key={s.title} style={{ gap: space(2) }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 24, color: colors.cream }}>
            {s.title}
          </Text>
          {s.body.map((p, i) => (
            <Body key={i} style={{ fontSize: 15, lineHeight: 22 }}>
              {p}
            </Body>
          ))}
        </View>
      ))}
    </Screen>
  );
}
