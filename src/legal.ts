// Privacy policy & terms shown in the app (REP-6). The data inventory behind them is docs/PRIVACY.md —
// keep both in step. DRAFT until reviewed by a qualified lawyer (see docs/PRIVACY.md → "Before launch").
import { PRIVACY_CONTACT } from './config';

export const LEGAL_UPDATED = 'November 24, 2026';

export interface LegalSection {
  title: string;
  body: string[];
}

const contact = PRIVACY_CONTACT
  ? `Email ${PRIVACY_CONTACT}.`
  : 'Use the contact details on the page where you got rep., or ask the person who invited you.';

export const PRIVACY: LegalSection[] = [
  {
    title: 'The short version',
    body: [
      'rep. stores your workouts and health data so the app works for you, and for nothing else. We don’t sell it, we don’t show ads, and we don’t use trackers or analytics.',
      'Your body measurements are private to you. Friends in a challenge can see only the workouts and steps from that challenge’s dates. The AI coach sends your data to Anthropic only after you allow it.',
      'You can download everything or delete your account at any time in You → Privacy & your data.',
    ],
  },
  {
    title: 'What we collect',
    body: [
      'Account: your email, a password (stored only as a secure hash by our database provider), your @username and display name.',
      'Profile: name, sex, birth year, height, goals, experience, training days, equipment, injuries or preferences you type in, step goal, goal weight and units.',
      'Training: workouts (exercises, sets, weights, reps, times), splits, targets and check-ins, custom exercises.',
      'Body: weight, body fat, waist and hip measurements you log.',
      'Activity: daily step counts you log or import.',
      'Wearables (only if you connect them): sleep, heart rate, HRV, readiness and steps from Apple Health or Oura. These stay on your phone except the daily steps, and a 7-day summary sent with AI coach requests you make.',
      'Settings: reminder time and time zone, notification preferences, and a record of what you agreed to and when.',
      'Devices: if you turn on notifications, a notification address for your phone (no contacts, location or advertising IDs).',
      'Error reports: if the app crashes, the type of error and the screen it happened on. Emails, IDs and all numbers are removed before it’s stored.',
    ],
  },
  {
    title: 'Consumer health data',
    body: [
      'Most of what rep. stores is health data: workouts, body measurements, steps, sleep and heart data, and injuries or limitations you mention. We collect it only to provide the features you use: logging, progress, reminders, challenges you join and, if you allow it, the AI coach.',
      'You give separate, explicit consent for this when you create your account, and again before the AI coach can use it. You can withdraw consent for the coach at any time, or delete everything.',
      'We never sell health data, and we only share it as described in “Who sees your data” below.',
    ],
  },
  {
    title: 'Who sees your data',
    body: [
      'You. Your body log, profile, splits, targets, reminders and consent record are visible only to you.',
      'Challenge members. When you join or create a challenge, its members can see your workouts (including exercises, sets, weights and reps) and daily steps from the challenge dates only — never your body measurements or profile, and nothing outside those dates. You’re asked to agree to this when you join.',
      'Friends see your @username and display name.',
      'Anthropic (AI coach), only after you allow it: each time you ask the coach something, your profile (including name, age, sex, height, injuries or preferences), weight and body-fat entries, goals, targets, split, recent workouts, estimated maxes and a 7-day wearable summary are sent to Anthropic’s Claude API to write the answer. Under Anthropic’s commercial terms, Anthropic acts as our data processor and may not train its models on this data.',
      'Service providers that run rep. for us: Supabase (database and sign-in), Render (hosting the app and server), Apple / Google / Mozilla push services (delivering notifications), Oura (only if you connect it), and an email provider (only if you turn on email reminders). They process data only to provide their service.',
      'If the law requires it, or to protect someone’s safety.',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'Your data stays in your account until you delete it or delete your account. Deleting your account removes it from our database right away, including your challenge workouts and steps.',
      'Error reports are kept 30 days. Daily coach-usage counters are kept 60 days.',
      'Data that stays only on your phone (wearable data, coach chat) is removed when you sign out or delete the app.',
    ],
  },
  {
    title: 'Your choices and rights',
    body: [
      'Download everything: You → Privacy & your data → Download my data (a JSON file).',
      'Correct it: edit or delete any entry in the app.',
      'Withdraw consent: turn off the AI coach in You → Privacy & your data; leave a challenge to stop sharing with its members.',
      'Delete your account: You → Privacy & your data → Delete my account. This is permanent.',
      `Anything else, or a question about your data: ${contact}`,
    ],
  },
  {
    title: 'Security',
    body: [
      'Data travels encrypted (HTTPS) and is encrypted at rest by our database provider. Database rules check every request so people can only reach their own data, and each feature is tested against those rules.',
      'The app keeps a copy of your data on your phone so it works offline. Use a passcode on your phone, and sign out on shared devices.',
      'No method is perfect. If a breach ever affects your data, we’ll tell you.',
    ],
  },
  {
    title: 'Children',
    body: ['rep. is for people 16 and older. If you believe someone younger has an account, contact us and we’ll delete it.'],
  },
  {
    title: 'Changes',
    body: ['If this policy changes in a way that matters, the app will ask you to review and agree again before you continue.'],
  },
];

export const TERMS: LegalSection[] = [
  {
    title: 'Using rep.',
    body: [
      'rep. helps you log workouts, track progress and train with friends. You must be 16 or older. Keep your password private; you’re responsible for activity on your account.',
    ],
  },
  {
    title: 'Not medical advice',
    body: [
      'rep. and its AI coach give general fitness information, not medical advice. The coach can be wrong. Talk to a doctor before starting a new program, especially if you’re pregnant, injured or have a health condition. Stop if something hurts.',
    ],
  },
  {
    title: 'Your content',
    body: [
      'What you log is yours. You let us store and process it only to run rep. for you, as described in the Privacy Policy, including showing challenge workouts and steps to members of challenges you join.',
    ],
  },
  {
    title: 'Fair play',
    body: [
      'Be kind in challenges and feeds. Don’t harass anyone, impersonate anyone, misuse invite links, try to access other people’s data, or overload the service. We may suspend accounts that do.',
    ],
  },
  {
    title: 'The service',
    body: [
      'rep. is offered as is, and it’s early: features change, and it may sometimes be unavailable. To the extent the law allows, we aren’t liable for indirect losses, lost data or injuries from exercise. You can stop using rep. and delete your account at any time.',
    ],
  },
  {
    title: 'Changes',
    body: ['If these terms change in a way that matters, the app will ask you to agree again before you continue.'],
  },
];
