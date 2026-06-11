import { test, expect } from "@playwright/test";

test("landing page renders and offers sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Reason it through|Hello/ }),
  ).toBeVisible();
});

test("sign-in page renders both providers", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await expect(
    page.getByRole("button", { name: /Continue with Google/i }),
  ).toBeVisible();
  await expect(page.getByLabel(/Email/i)).toBeVisible();
});

test("protected route redirects to sign-in when unauthenticated", async ({
  page,
}) => {
  const response = await page.goto("/session/new");
  expect(response?.url()).toContain("/auth/sign-in");
});
