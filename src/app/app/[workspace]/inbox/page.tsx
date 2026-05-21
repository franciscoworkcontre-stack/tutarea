import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InboxView from "@/components/inbox/inbox-view";

type Props = {
  params: Promise<{ workspace: string }>;
};

export default async function InboxPage({ params }: Props) {
  const { workspace } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <InboxView workspaceSlug={workspace} />;
}
