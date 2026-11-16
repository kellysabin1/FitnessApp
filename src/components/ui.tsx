import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import {
  ActivityIndicator,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, gradients, radius, space } from '../theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const Icon = ({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: string }) => (
  <Ionicons name={name} size={size} color={color} />
);

export const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

// ---------- Layout ----------
export function Screen({
  children,
  scroll = true,
  padTop = true,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padTop?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: padTop ? insets.top + space(4) : space(4), paddingBottom: insets.bottom + space(28) };
  return (
    <LinearGradient colors={gradients.screen} style={{ flex: 1 }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, pad, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, pad, { flex: 1 }, contentStyle]}>{children}</View>
      )}
    </LinearGradient>
  );
}

export const Row = ({ children, style, gap = 3 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space(gap) }, style]}>{children}</View>
);

// ---------- Type ----------
export const Eyebrow = ({ children, color = colors.latte, style }: { children: React.ReactNode; color?: string; style?: StyleProp<TextStyle> }) => (
  <Text style={[styles.eyebrow, { color }, style]}>{children}</Text>
);
export const Display = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) => (
  <Text style={[styles.display, style]}>{children}</Text>
);
export const H2 = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) => (
  <Text style={[styles.h2, style]}>{children}</Text>
);
export const Body = ({
  children,
  muted,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) => (
  <Text numberOfLines={numberOfLines} style={[styles.body, muted && { color: colors.textMuted }, style]}>
    {children}
  </Text>
);
export const Italic = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) => (
  <Text style={[{ fontFamily: fonts.displayItalic, color: colors.latte }, style]}>{children}</Text>
);

// ---------- Surfaces ----------
// Tones: plain card, cocoa/mocha gradients, croc leather texture, cocoa cabana stripes.
export type Tone = 'default' | 'cocoa' | 'mocha' | 'croc' | 'tortoise' | 'satin' | 'stripe';
// Swap these files to change the textures — any image works.
const TEXTURES = {
  croc: require('../../assets/textures/croc.jpg'),
  tortoise: require('../../assets/textures/tortoise.jpg'),
  satin: require('../../assets/textures/satin.jpg'),
};

export function Card({
  children,
  tone = 'default',
  style,
  onPress,
}: {
  children: React.ReactNode;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  let inner: React.ReactNode;
  if (tone === 'croc' || tone === 'tortoise' || tone === 'satin') {
    inner = (
      <ImageBackground source={TEXTURES[tone]} resizeMode="cover" style={[styles.card, styles.textured, style]}>
        <LinearGradient
          colors={tone === 'croc' ? ['rgba(20,13,11,0.35)', 'rgba(20,13,11,0.7)'] : ['rgba(20,13,11,0.45)', 'rgba(20,13,11,0.78)']}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </ImageBackground>
    );
  } else if (tone === 'stripe') {
    inner = (
      <View style={[styles.card, styles.textured, { backgroundColor: colors.cocoaDeep }, style]}>
        <Stripes />
        <LinearGradient colors={['rgba(29,21,19,0.25)', 'rgba(29,21,19,0.75)']} style={StyleSheet.absoluteFill} />
        {children}
      </View>
    );
  } else if (tone === 'default') {
    inner = <View style={[styles.card, style]}>{children}</View>;
  } else {
    inner = (
      <LinearGradient
        colors={gradients[tone]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, styles.textured, style]}
      >
        {children}
      </LinearGradient>
    );
  }
  if (!onPress) return inner;
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => ({ flexDirection: 'column', opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
    >
      {inner}
    </Pressable>
  );
}

/** Cocoa cabana stripes, drawn as SVG so they stay crisp at any size. */
function Stripes() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <Pattern id="cabana" patternUnits="userSpaceOnUse" width={28} height={10}>
          <Rect x={0} y={0} width={14} height={10} fill={colors.cocoa} />
          <Rect x={14} y={0} width={14} height={10} fill={colors.cocoaDeep} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#cabana)" />
    </Svg>
  );
}

/** The thin latte line-heart brand mark. */
export const Heart = ({ size = 18, color = colors.latte }: { size?: number; color?: string }) => (
  <Ionicons name="heart-outline" size={size} color={color} />
);

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space(7), marginBottom: space(3) }}>
      <H2>{title}</H2>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={styles.link}>{action}</Text>
        </Pressable>
      ) : null}
    </Row>
  );
}

// ---------- Controls ----------
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  small,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const fg = variant === 'primary' ? colors.bg : variant === 'danger' ? colors.danger : colors.text;
  const content = (
    <Row gap={2} style={{ justifyContent: 'center' }}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <Text style={[styles.btnText, { color: fg }, small && { fontSize: 13 }]}>{title}</Text>
    </Row>
  );
  const base = [styles.btn, small && styles.btnSmall, (disabled || loading) && { opacity: 0.5 }];
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }, style]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={gradients.latte} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={base}>
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            ...base,
            variant === 'secondary' && { backgroundColor: colors.cardSoft, borderWidth: 1, borderColor: colors.line },
            variant === 'ghost' && { backgroundColor: 'transparent' },
            variant === 'danger' && { borderWidth: 1, borderColor: 'rgba(196,106,94,0.4)' },
          ]}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable
      onPress={() => { tap(); onPress?.(); }}
      style={[styles.chip, active && { backgroundColor: colors.burgundy, borderColor: 'rgba(216,193,166,0.45)' }]}
    >
      <Row gap={1.5}>
        {icon ? <Icon name={icon} size={14} color={active ? colors.cream : colors.textMuted} /> : null}
        <Text style={[styles.chipText, active && { color: colors.cream }]}>{label}</Text>
      </Row>
    </Pressable>
  );
}

export function Field({
  label,
  suffix,
  style,
  ...props
}: TextInputProps & { label?: string; suffix?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: space(1.5) }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrap}>
        <TextInput placeholderTextColor={colors.textFaint} style={styles.input} {...props} />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function Stat({ label, value, unit, icon }: { label: string; value: string; unit?: string; icon?: IconName }) {
  return (
    <View style={{ flex: 1, gap: space(1) }}>
      <Row gap={1.5}>
        {icon ? <Icon name={icon} size={13} color={colors.textMuted} /> : null}
        <Text style={styles.label}>{label}</Text>
      </Row>
      <Text style={styles.statValue}>
        {value}
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export function Empty({ icon, title, text, children }: { icon: IconName; title: string; text: string; children?: React.ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: space(8), gap: space(2) }}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={22} color={colors.latte} />
      </View>
      <H2 style={{ textAlign: 'center' }}>{title}</H2>
      <Body muted style={{ textAlign: 'center', maxWidth: 280 }}>{text}</Body>
      {children ? <View style={{ marginTop: space(3), alignSelf: 'stretch' }}>{children}</View> : null}
    </Card>
  );
}

export const Divider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: space(3) }} />;

const styles = StyleSheet.create({
  content: { paddingHorizontal: space(5) },
  eyebrow: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 3.6, textTransform: 'uppercase' },
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.cream, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.display, fontSize: 24, color: colors.cream },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text },
  link: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.latte },
  textured: { borderColor: 'rgba(232,214,194,0.10)' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space(5),
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  btn: { height: 54, borderRadius: radius.pill, paddingHorizontal: space(6), justifyContent: 'center' },
  btnSmall: { height: 38, paddingHorizontal: space(4) },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 15, letterSpacing: 0.3 },
  chip: {
    paddingHorizontal: space(3.5),
    paddingVertical: space(2),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bgRaised,
  },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  label: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.4 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space(4),
  },
  input: { flex: 1, minWidth: 0, height: 50, color: colors.cream, fontFamily: fonts.body, fontSize: 16, outlineStyle: 'none' as never },
  suffix: { fontFamily: fonts.body, color: colors.textMuted, marginLeft: space(2) },
  statValue: { fontFamily: fonts.display, fontSize: 30, color: colors.cream },
  statUnit: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.cocoaDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space(1),
  },
});
