export type ChatAttachment = {
  id: string;
  mediaType: string;
  fileName: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
};
