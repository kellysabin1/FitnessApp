import { Pressable, Text, View } from 'react-native';
import { colors, fonts, space } from '../theme';
import { Icon } from './ui';

/** A tick box with a label. `children` can include links. */
export function Checkbox({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={{ flexDirection: 'row', gap: space(3), alignItems: 'flex-start' }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          marginTop: 1,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? colors.olive : colors.textMuted,
          backgroundColor: checked ? colors.olive : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Icon name="checkmark" size={16} color={colors.cream} /> : null}
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.text }}>{children ?? label}</Text>
    </Pressable>
  );
}

/** Inline link inside text. */
export function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Text
      onPress={onPress}
      accessibilityRole="link"
      style={{ color: colors.latte, textDecorationLine: 'underline', fontFamily: fonts.bodyMedium }}
    >
      {title}
    </Text>
  );
}
