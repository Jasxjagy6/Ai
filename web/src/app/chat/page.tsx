import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ChatApp } from "@/components/chat/chat-app";
import { getUserTier } from "@/lib/usage";
import { getPlan } from "@/lib/plans";

export default async function ChatPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const tier = await getUserTier(user.id);
  const plan = await getPlan(tier);

  return <ChatApp userName={user.name ?? "you"} tier={tier} dailyLimit={plan.messagesPerDay} />;
}
