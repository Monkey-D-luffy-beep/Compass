import { PulsePanel } from '@/components/PulsePanel';
import { PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pulse' };

export default function Pulse() {
  return (
    <>
      <PageHead title="Pulse" sub="What changed in the last 7 days against the 7 before: money from Dodo, signups, uninstalls and usage from the Nexora dashboard. Read-only." />
      <PulsePanel />
    </>
  );
}
