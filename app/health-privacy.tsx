import { LegalPage } from '@/src/components/LegalPage';
import { HEALTH_PRIVACY } from '@/src/legal';

export default function HealthPrivacy() {
  return <LegalPage sections={HEALTH_PRIVACY} />;
}
