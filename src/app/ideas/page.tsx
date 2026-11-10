import { getDb } from '@/lib/runtime';
import { listIdeas } from '@/lib/store';
import { IdeasBoard } from '@/components/IdeasBoard';
import { PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ideas' };

export default async function Ideas() {
  const db = await getDb();
  return (
    <>
      <PageHead title="Ideas" sub="Next projects and ways to earn more. Each one says why it could earn and the cheapest test before you build. The seeded ones are unproven: they come from your own numbers, not from a market test." />
      <IdeasBoard ideas={await listIdeas(db)} />
    </>
  );
}
