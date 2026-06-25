"use client";

import { useParams } from "next/navigation";

import ChatThread from "@/components/chat/ChatThread";

/** Chat thread screen — `/chat/:conversationId`. */
export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  return <ChatThread conversationId={id} />;
}
