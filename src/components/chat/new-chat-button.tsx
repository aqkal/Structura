import { LinkButton } from "@/components/ui/button";

export function NewChatButton() {
  return (
    <LinkButton href="/chat" variant="secondary" size="sm" className="w-full">
      + New chat
    </LinkButton>
  );
}
