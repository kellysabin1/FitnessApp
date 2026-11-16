// rep. design tokens — chocolate, cocoa, espresso, latte.
// Inspired by: giraffe & croc textures, cocoa cabana stripes, a tiny latte line-heart.
export const colors = {
  bg: '#1E1714', // deep espresso
  bgRaised: '#251C18',
  card: '#2B211C', // Espresso #2B211C
  cardSoft: '#342822',
  line: 'rgba(232, 214, 194, 0.09)',

  cocoa: '#4A3329', // light stripe
  cocoaDeep: '#2C1F1A', // dark stripe
  mocha: '#5C3A27', // walnut
  mochaDeep: '#3D271B',
  umber: '#3A2A22',

  burgundy: '#633A38', // Oxide — secondary accent
  burgundyDeep: '#3A2120',
  olive: '#6B6947', // Burnt Olive — 'done' moments
  taupe: '#A99B88', // taupe stone
  brass: '#A58A61', // Muted Brass — tiny details only (PRs)

  latte: '#E8E0D2', // Bone — primary accent (heart, buttons, rings)
  latteDeep: '#CFC5B4',
  sand: '#A99B88', // taupe

  cream: '#E8E0D2',
  text: '#E8E0D2',
  textMuted: 'rgba(232, 224, 210, 0.62)',
  textFaint: 'rgba(232, 224, 210, 0.36)',

  danger: '#B97563',
};

export const gradients = {
  screen: ['#241B17', '#1E1714', '#191310'] as const,
  cocoa: ['#4A3329', '#2E211B'] as const,
  mocha: ['#5C3A27', '#35221A'] as const,
  latte: ['#EEE7DB', '#D6CCBC'] as const,
};

export const fonts = {
  display: 'CormorantGaramond_500Medium',
  displayItalic: 'CormorantGaramond_500Medium_Italic',
  displayBold: 'CormorantGaramond_700Bold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
};

export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 };
export const space = (n: number) => n * 4;
