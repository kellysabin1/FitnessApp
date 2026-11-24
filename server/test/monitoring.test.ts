// Error reports must never carry personal data. Run: npm test (in server/)
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { scrub } from '../src/monitoring.js';

const cases: [string, string[]][] = [
  ['Failed for jane.doe+gym@icloud.com weight 64.5kg hr 152', ['jane', '64', '152', 'icloud']],
  ['token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1QSJ9.abc123def456 bad', ['eyJ']],
  ['user 4e5475ed-b727-4c7c-9503-4300e98b45c2 not found', ['4e5475ed']],
  ['key sk-ant-api03-abcdefghijklmnop leaked', ['sk-ant', 'abcdefghijklmnop']],
  ['bench 135x8 then 145 x 8 at 7:30pm', ['135', '145', '7:30']],
];

for (const [input, banned] of cases) {
  test(`scrubs: ${input.slice(0, 30)}…`, () => {
    const out = scrub(input);
    for (const b of banned) assert.ok(!out.includes(b), `"${b}" leaked into: ${out}`);
  });
}

test('caps length', () => assert.equal(scrub('x'.repeat(2000)).length <= 500, true));
