import { expect, test } from "@playwright/test";

test("creates an account, project, task, and completes it", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByLabel("Email").fill(`qa-${testInfo.project.name}-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("secure-pass-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: /keep moving/i })).toBeVisible();

  await page.getByLabel("Project name").fill("Browser automation");
  await page.getByLabel("Project description").fill("Exercise the complete learning flow");
  await page.getByRole("button", { name: /add project/i }).click();
  await expect(page.getByRole("heading", { name: "Browser automation", exact: true }).first()).toBeVisible();

  await page.getByLabel("Task title").fill("Finish the QA loop");
  await page.getByLabel("Task notes").fill("Created by Playwright");
  await page.getByLabel("Priority").selectOption("high");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Finish the QA loop" })).toBeVisible();

  await page.getByLabel("Complete Finish the QA loop").click();
  await expect(page.getByLabel("Reopen Finish the QA loop")).toBeVisible();
});
