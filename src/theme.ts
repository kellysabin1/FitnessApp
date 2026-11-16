// Velour design tokens — espresso, mocha, plum, deep green, gold, cream.
export const colors = {
  bg: '#17110E', // espresso, near-black
  bgRaised: '#211915',
  card: '#2A201B',
  cardSoft: '#33271F',
  line: 'rgba(243, 235, 221, 0.09)',

  mocha: '#8B6B58',
  mochaDeep: '#5C4334',
  plum: '#6B3A55',
  plumDeep: '#3E2232',
  green: '#3E5C4A',
  greenDeep: '#24382C',
  gold: '#C9A45C',
  goldSoft: '#E2C98F',
  blush: '#D9A7A0',

  cream: '#F3EBDD',
  white: '#FFFFFF',
  text: '#F3EBDD',
  textMuted: 'rgba(243, 235, 221, 0.62)',
  textFaint: 'rgba(243, 235, 221, 0.38)',

  danger: '#C46A5E',
};

export const gradients = {
  screen: ['#1E1612', '#17110E', '#140E0C'] as const,
  plum: ['#6B3A55', '#3E2232'] as const,
  mocha: ['#8B6B58', '#4A362A'] as const,
  green: ['#3E5C4A', '#1F3127'] as const,
  gold: ['#E2C98F', '#B38B44'] as const,
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
