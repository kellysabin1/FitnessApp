import { useEffect, useState } from 'react';
import { Body, Button, Card, Eyebrow, Icon, Row } from '../components/ui';
import { colors, space } from '../theme';
import { enablePush, pushState, type PushState } from './push';

/** "Turn on notifications" card for the Friends tab. Hides itself once on (or where unsupported). */
export function PushPrompt() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    pushState().then(setState).catch(() => setState('unsupported'));
  }, []);

  if (!state || state === 'on' || state === 'unsupported') return null;

  return (
    <Card style={{ marginTop: space(5), gap: space(2) }}>
      <Row gap={2}>
        <Icon name="notifications-outline" size={16} color={colors.latte} />
        <Eyebrow>Notifications</Eyebrow>
      </Row>
      {state === 'needs-home-screen' ? (
        <Body muted style={{ fontSize: 14 }}>
          To get a ping when friends finish a workout, open rep. from your home screen (Safari → Share → Add to Home Screen).
        </Body>
      ) : state === 'denied' ? (
        <Body muted style={{ fontSize: 14 }}>
          Notifications are blocked. Turn them on in iPhone Settings → Notifications → rep.
        </Body>
      ) : (
        <>
          <Body muted style={{ fontSize: 14 }}>Get a ping when friends finish a workout or nudge you.</Body>
          <Button
            small
            title="Turn on notifications"
            loading={busy}
            style={{ marginTop: space(2) }}
            onPress={async () => {
              setBusy(true);
              setErr(null);
              try {
                await enablePush();
                setState('on');
              } catch (e) {
                setErr((e as Error).message);
                setState(await pushState());
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
      {err ? <Body style={{ color: colors.sand, fontSize: 13 }}>{err}</Body> : null}
    </Card>
  );
}
