import { readFileSync } from "node:fs";
import path from "node:path";

export type PromptName = "scaffold" | "feedback" | "hint" | "chat";

function loadTemplate(name: PromptName): string {
  return readFileSync(
    path.join(process.cwd(), "src/lib/server/ai/prompts", `${name}.md`),
    "utf8",
  );
}

const templates: Record<PromptName, string> = {
  scaffold: loadTemplate("scaffold"),
  feedback: loadTemplate("feedback"),
  hint: loadTemplate("hint"),
  chat: loadTemplate("chat"),
};

export function renderPrompt(
  name: PromptName,
  vars: Record<string, string | number>,
): string {
  return templates[name].replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      throw new Error(
        `renderPrompt: template "${name}" uses placeholder "{{${key}}}" but no matching var was provided`,
      );
    }
    return String(value);
  });
}
