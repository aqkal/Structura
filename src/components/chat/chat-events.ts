export const CHAT_CREATED_EVENT = "structura:chat-created";

export type ChatCreatedDetail = {
  id: string;
};

export function emitChatCreated(detail: ChatCreatedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ChatCreatedDetail>(CHAT_CREATED_EVENT, { detail }),
  );
}

export function onChatCreated(
  handler: (detail: ChatCreatedDetail) => void,
): () => void {
  const listener = (event: Event) => {
    const custom = event as CustomEvent<ChatCreatedDetail>;
    if (custom.detail?.id) handler(custom.detail);
  };
  window.addEventListener(CHAT_CREATED_EVENT, listener);
  return () => window.removeEventListener(CHAT_CREATED_EVENT, listener);
}

export const CHAT_TITLED_EVENT = "structura:chat-titled";

export type ChatTitledDetail = {
  id: string;
  title: string;
};

export function emitChatTitled(detail: ChatTitledDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ChatTitledDetail>(CHAT_TITLED_EVENT, { detail }),
  );
}

export function onChatTitled(
  handler: (detail: ChatTitledDetail) => void,
): () => void {
  const listener = (event: Event) => {
    const custom = event as CustomEvent<ChatTitledDetail>;
    if (custom.detail?.id && custom.detail.title) handler(custom.detail);
  };
  window.addEventListener(CHAT_TITLED_EVENT, listener);
  return () => window.removeEventListener(CHAT_TITLED_EVENT, listener);
}
