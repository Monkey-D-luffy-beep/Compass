import { hasKey } from '@/lib/ai';
import { getDb } from '@/lib/runtime';
import { listMessages } from '@/lib/store';
import { AskPanel } from '@/components/AskPanel';
import { PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Assistant' };

export default async function Assistant() {
  const db = await getDb();
  return (
    <>
      <PageHead title="Assistant" sub="Ask what to work on, where the money is, or what you are avoiding. It reads your brain file and your live plan every time." />
      <AskPanel initial={await listMessages(db)} hasKey={await hasKey(db)} />
    </>
  );
}
