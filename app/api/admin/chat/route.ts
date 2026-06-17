/**
 * This is where the admin chat API route will live.
 *
 * During the workshop you'll wire this up to the agent in `lib/agent.ts`
 * using `createAgentUIStreamResponse` from the AI SDK. The chat panel in
 * `components/agent-chat.tsx` posts here once you swap its placeholder
 * `useState` for `useChat`.
 *
 * Workshop docs: https://agent-foundations-certification.vercel.app/docs/admin-chat-agent
 */

import { createAgentUIStreamResponse } from "ai";
import { type AdminAgentUIMessage, adminAgent } from "@/lib/admin-agent";
import { createOrGetSandbox } from "@/lib/sandbox"; 
export const POST = async (req: Request) => {
  const { messages }: { messages: AdminAgentUIMessage[] } = await req.json();
  const sandbox = await createOrGetSandbox("admin-agent-sandbox"); 
  return createAgentUIStreamResponse({
    agent: adminAgent,
    uiMessages: messages,
    options: { sandbox }, 
  });
};
