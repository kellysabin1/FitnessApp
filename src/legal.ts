// Privacy Policy, Consumer Health Data Privacy Policy and Terms shown in the app (REP-6).
// The data inventory behind them is docs/PRIVACY.md and the compliance review is docs/LEGAL-REVIEW.md —
// keep all three in step. Operator name, contact and governing law come from src/config.ts.
import { GOVERNING_LAW, OPERATOR_NAME, PRIVACY_CONTACT } from './config';

export const LEGAL_UPDATED = 'November 24, 2026';

export interface LegalSection {
  title: string;
  body: string[];
}

const who = OPERATOR_NAME ? `rep. is run by ${OPERATOR_NAME} (“we”, “us”).` : 'rep. is run by an independent developer (“we”, “us”).';
const contact = PRIVACY_CONTACT
  ? `email ${PRIVACY_CONTACT}`
  : 'use the contact details on the page where you got rep., or ask the person who invited you';

const RIGHTS = [
  'Access and copy: You → Privacy & your data → Download my data gives you everything we hold about you as a file. You can also ask us for a list of every third party and service provider your data has been shared with, and how to contact them.',
  'Correct: edit or delete any entry in the app.',
  'Delete: You → Privacy & your data → Delete my account permanently deletes your account and data from our database straight away. We don’t make or keep separate backups, and our service providers delete any copies they hold under their own terms (for example, Anthropic deletes AI coach requests after a limited period).',
  'Withdraw consent: turn off the AI coach in You → Privacy & your data; leave a challenge to stop sharing with its members; or delete your account. Withdrawing doesn’t undo what was already processed lawfully before.',
  `Other requests, or if you can’t use the in-app tools: ${contact}. We answer within 45 days (we may extend once by 45 days if needed, and will tell you why). We may need to confirm it’s really you.`,
  `Appeal: if we turn down a request, you can appeal by replying to our answer with “Appeal” — we’ll respond within 45 days and explain the outcome. If you’re still unhappy you can contact your state attorney general (in Washington: atg.wa.gov).`,
  'We never charge for these requests or treat you differently for using your rights.',
];

/** Required as its own policy, linked from the start screen (Washington MHMDA, Nevada SB 370, Connecticut). */
export const HEALTH_PRIVACY: LegalSection[] = [
  {
    title: 'About this policy',
    body: [
      `${who} This Consumer Health Data Privacy Policy explains how we handle “consumer health data” — information that is linked to you and identifies your past, present or future physical health. It sits alongside our general Privacy Policy.`,
    ],
  },
  {
    title: 'Health data we collect',
    body: [
      'Workouts: exercises, sets, weights, reps, durations and dates.',
      'Body measurements: weight, body fat, waist and hips.',
      'Activity: daily steps.',
      'Wearable data, if you connect Apple Health or Oura: sleep, heart rate, heart-rate variability, readiness and steps.',
      'Profile details that relate to health: sex, age (birth year), height, goal weight, fitness goals and level, and any injuries, conditions or limitations you type in.',
      'Targets and progress check-ins, and what you tell the AI coach.',
      'Inferences: estimated one-rep maxes, progress toward targets, and the coach’s suggestions.',
    ],
  },
  {
    title: 'Where it comes from',
    body: [
      'From you, when you type it in; from Apple Health or Oura, only if you connect them; and from the app itself when it calculates progress and estimates.',
    ],
  },
  {
    title: 'Why we collect and use it',
    body: [
      'Only to provide the features you ask for: logging and history, progress and targets, reminders, challenges you join, and — if you allow it — the AI coach. We don’t use it for advertising, we don’t build profiles to sell, and we don’t sell it. We don’t use geofencing.',
      'We collect it only with your consent, which you give separately when you create your account. We ask again, separately, before your data is used by the AI coach, and before it’s shared with members of a challenge.',
    ],
  },
  {
    title: 'Who we share it with',
    body: [
      'Members of a challenge you choose to join: your workouts and daily steps from the challenge dates only (never body measurements or profile).',
      'Service providers (processors) that run rep. for us under contract and may use it only to provide their service: Supabase (database and sign-in, data hosted on Amazon Web Services), Render (hosting), Anthropic (AI coach, only after you allow it), Apple, Google and Mozilla push services (delivering notifications), Oura (only if you connect it).',
      'We don’t sell consumer health data, and we don’t share it with anyone else unless the law requires it. Contact details for any of these companies are available on request.',
    ],
  },
  { title: 'Your rights', body: RIGHTS },
  {
    title: 'Keeping it safe',
    body: [
      'Encrypted in transit and at rest, strict per-person access rules in the database, access limited to the people who run rep., and scrubbed error reports with no health values. If a breach ever affects your data, we’ll notify you without unreasonable delay (and within 60 days), and notify regulators where the law requires.',
    ],
  },
];

export const PRIVACY: LegalSection[] = [
  {
    title: 'The short version',
    body: [
      `${who} We store your workouts and health data so the app works for you, and for nothing else. We don’t sell it, we don’t show ads, and we don’t use trackers or analytics.`,
      'Your body measurements are private to you. Friends in a challenge can see only the workouts and steps from that challenge’s dates. The AI coach sends your data to Anthropic only after you allow it.',
      'You can download everything or delete your account at any time in You → Privacy & your data. Our Consumer Health Data Privacy Policy has more detail on health data specifically.',
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
      'Technical data: our hosting and database providers keep short-lived service logs that include IP addresses and request times, for security and troubleshooting.',
      'Error reports: if the app crashes, the type of error and the screen it happened on. Emails, IDs and all numbers are removed before it’s stored.',
    ],
  },
  {
    title: 'How we use it, and our legal basis',
    body: [
      'To provide rep. to you (our contract with you); health data only with your explicit consent; to keep rep. secure and fix problems (our legitimate interest in running a safe service); and to meet legal obligations. Nothing is used for ads, sold, or used to make decisions about you with legal or similarly significant effects.',
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
      'Your data stays in your account until you delete it or delete your account. Deleting your account removes it from our database right away, including your challenge workouts and steps. We don’t make or keep separate backups.',
      'Error reports are kept 30 days. Daily coach-usage counters are kept 60 days. Provider service logs are kept for the providers’ standard short periods.',
      'Data that stays only on your phone (wearable data, coach chat) is removed when you sign out or delete the app.',
    ],
  },
  { title: 'Your choices and rights', body: RIGHTS },
  {
    title: 'Where your data is processed',
    body: [
      'rep. and its service providers are based in the United States, and your data is stored and processed there. If you use rep. from outside the US (for example the EU or UK), your data is transferred to the US, and you can also complain to your local data protection authority.',
    ],
  },
  {
    title: 'Security',
    body: [
      'Data travels encrypted (HTTPS) and is encrypted at rest by our database provider. Database rules check every request so people can only reach their own data, and each feature is tested against those rules.',
      'The app keeps a copy of your data on your phone so it works offline. Use a passcode on your phone, and sign out on shared devices.',
      'No method is perfect. If a breach ever affects your data, we’ll notify you without unreasonable delay (and within 60 days), and notify regulators where the law requires.',
    ],
  },
  {
    title: 'Children',
    body: [
      'rep. is for people 16 and older, and we don’t knowingly collect data from anyone younger. If you believe someone younger has an account, contact us and we’ll delete it.',
    ],
  },
  {
    title: 'Changes',
    body: [
      'If this policy changes in a way that matters, the app will ask you to review and agree again before you continue. We won’t use data already collected in a materially different way without your consent.',
    ],
  },
  { title: 'Contact', body: [`Questions about privacy: ${contact}.`] },
];

export const TERMS: LegalSection[] = [
  {
    title: 'Who we are',
    body: [`${who} By creating an account or using rep., you agree to these terms and to our Privacy Policy.`],
  },
  {
    title: 'Using rep.',
    body: [
      'You must be 16 or older. Keep your password private; you’re responsible for activity on your account. rep. is for personal, non-commercial use.',
    ],
  },
  {
    title: 'Not medical advice',
    body: [
      'rep. and its AI coach give general fitness information, not medical advice, diagnosis or treatment. rep. is not a medical device. The coach is automated and can be wrong or incomplete — use your judgment. Talk to a doctor before starting a new program, especially if you’re pregnant, injured or have a health condition, and stop if something hurts or feels wrong.',
      'Exercise carries a risk of injury. You choose what you do and take responsibility for doing it safely.',
    ],
  },
  {
    title: 'Your content',
    body: [
      'What you log is yours. You give us permission to store and process it only to run rep. for you, as described in the Privacy Policy, including showing challenge workouts and steps to members of challenges you join.',
    ],
  },
  {
    title: 'Fair play',
    body: [
      'Be kind in challenges and feeds. Don’t harass anyone, impersonate anyone, misuse invite links, try to access other people’s data, reverse-engineer or overload the service, or use it for anything illegal. We may suspend or close accounts that do.',
    ],
  },
  {
    title: 'The service',
    body: [
      'rep. is free and early: features change, and it may sometimes be unavailable or lose data. We can change or stop the service; if we stop it, we’ll give you notice and a chance to download your data.',
      'REP. IS PROVIDED “AS IS” AND “AS AVAILABLE”, WITHOUT WARRANTIES OF ANY KIND, TO THE FULLEST EXTENT THE LAW ALLOWS. WE AREN’T LIABLE FOR INDIRECT, INCIDENTAL OR CONSEQUENTIAL DAMAGES, LOST DATA, OR INJURIES FROM EXERCISE, AND OUR TOTAL LIABILITY IS LIMITED TO $50. Some places don’t allow these limits, so they may not fully apply to you; nothing here limits rights you have that can’t be waived.',
    ],
  },
  {
    title: 'Ending things',
    body: ['You can stop using rep. and delete your account at any time. We may close accounts that break these terms.'],
  },
  {
    title: 'Law and disputes',
    body: [
      GOVERNING_LAW
        ? `These terms are governed by the laws of ${GOVERNING_LAW}, and disputes go to its courts, unless the law where you live says otherwise.`
        : 'These terms are governed by the laws of the US state where rep.’s operator lives, unless the law where you live says otherwise.',
      `If something goes wrong, please contact us first — ${contact} — and we’ll try to sort it out.`,
    ],
  },
  {
    title: 'Changes',
    body: ['If these terms change in a way that matters, the app will ask you to agree again before you continue.'],
  },
];
