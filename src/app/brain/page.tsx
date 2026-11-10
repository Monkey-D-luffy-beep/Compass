import { readBrain } from '@/lib/brain';
import { getDb } from '@/lib/runtime';
import { BrainEditor } from '@/components/SettingsForms';
import { PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Brain' };

export default async function Brain() {
  return (
    <>
      <PageHead title="Brain" sub="Everything the assistant knows about you before you ask. Every line is treated as fact, so keep it true. It is saved in your database, so it is the same on your phone and your computer." />
      <BrainEditor initial={await readBrain(await getDb())} file="your database" />
    </>
  );
}
