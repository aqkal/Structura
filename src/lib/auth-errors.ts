/**
 * Friendly copy for Supabase auth errors.
 *
 * Maps the most common raw error messages to calm, human sentences in the
 * app voice. Matching is case-insensitive and substring-based so minor
 * upstream wording changes still match. Unknown errors fall back to the
 * original message untouched.
 */

type Rule = {
  match: RegExp;
  friendly: string | ((match: RegExpMatchArray) => string);
};

const rules: Rule[] = [
  {
    match: /invalid login credentials/i,
    friendly: "Email or password is incorrect.",
  },
  {
    match: /email not confirmed/i,
    friendly:
      "This email has not been confirmed yet. Check your inbox for the code or link.",
  },
  {
    match: /user already registered|already been registered/i,
    friendly:
      "An account with this email already exists. Try signing in instead.",
  },
  {
    match: /token has expired or is invalid/i,
    friendly:
      "That code did not match or has expired. Check it, or request a new one.",
  },
  {
    match: /email link is invalid or has expired/i,
    friendly: "That link is invalid or has expired. Request a new one.",
  },
  {
    match: /signups not allowed for otp|user not found/i,
    friendly:
      "We could not find an account for that email. Check the address, or create an account first.",
  },
  {
    match: /only request this after (\d+) seconds?/i,
    friendly: (m) =>
      `Please wait ${m[1]} seconds before requesting another email.`,
  },
  {
    match: /email rate limit exceeded/i,
    friendly: "Too many emails sent for now. Wait a few minutes and try again.",
  },
  {
    match: /rate limit/i,
    friendly: "Too many attempts for now. Wait a moment and try again.",
  },
  {
    match: /password should be at least (\d+) characters/i,
    friendly: (m) => `Password must be at least ${m[1]} characters.`,
  },
  {
    match: /new password should be different/i,
    friendly: "Your new password must be different from the old one.",
  },
  {
    match: /auth session missing/i,
    friendly:
      "Your reset link has expired. Request a new one from the forgot password page.",
  },
  {
    match: /failed to fetch|network ?error|load failed/i,
    friendly:
      "We could not reach the server. Check your connection and try again.",
  },
];

/**
 * Returns a calm, friendly version of a Supabase auth error message.
 * Unknown messages pass through unchanged.
 */
export function friendlyAuthError(message: string | null | undefined): string {
  if (!message) return "Something went wrong. Please try again.";
  for (const rule of rules) {
    const m = message.match(rule.match);
    if (m) {
      return typeof rule.friendly === "function"
        ? rule.friendly(m)
        : rule.friendly;
    }
  }
  return message;
}
