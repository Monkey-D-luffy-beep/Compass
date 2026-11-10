import { MODELS, currentModel, hasKey } from '@/lib/ai';
import { getDb } from '@/lib/runtime';
import { revenueGoal } from '@/lib/store';
import { SettingsForm } from '@/components/SettingsForms';
import { PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

export default async function Settings() {
  const db = await getDb();
  return (
    <>
      <PageHead title="Settings" />
      <div className="max-w-2xl">
        <SettingsForm hasKey={await hasKey(db)} fromEnv={!!process.env.ANTHROPIC_API_KEY} model={await currentModel(db)} models={[...MODELS]} goal={await revenueGoal(db)} />
      </div>
    </>
  );
}
