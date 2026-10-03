import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure", channel: process.env.PLAYWRIGHT_CHANNEL },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: [
    {
      command: "cd ../backend && DATABASE_URL=sqlite:///./learning_tracker_e2e.db .venv/bin/alembic upgrade head && DATABASE_URL=sqlite:///./learning_tracker_e2e.db FRONTEND_ORIGIN=http://127.0.0.1:4173 .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8010",
      url: "http://127.0.0.1:8010/health",
      reuseExistingServer: true,
    },
    {
      command: "VITE_API_URL=http://127.0.0.1:8010/api/v1 npm run dev -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
    },
  ],
});
