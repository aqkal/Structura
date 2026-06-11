import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Prompt templates live as .md files next to this module so they can be
 * reviewed and diffed like product copy (they ARE the product). They are
 * read once, synchronously, at module init and cached in module scope.
 */

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

/**
 * Render a prompt template, interpolating every {{key}} placeholder from
 * `vars`. Throws if the template references a key that was not provided,
 * so a typo in a template fails loudly instead of leaking "{{stepNum}}"
 * into a live system prompt.
 */
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
