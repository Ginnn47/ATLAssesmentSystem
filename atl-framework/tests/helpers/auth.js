import { expect } from "@playwright/test";

export async function login(page, username, password) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.evaluate(() => {
    window.localStorage.removeItem("atl_current_user");
    window.localStorage.removeItem("atl_subject_catalog_snapshot");
    window.sessionStorage.clear();
  });

  const loginResult = await page.evaluate(async ({ username: loginUsername, password: loginPassword }) => {
    const response = await fetch("/api/auth/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: loginUsername, password: loginPassword }),
    });
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text(),
    };
  }, { username, password });
  const rawBody = loginResult.text;
  let body = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    body = { error: rawBody };
  }
  expect(loginResult.ok, `Login gagal untuk ${username}. Status ${loginResult.status}: ${body.error || rawBody}`).toBeTruthy();
  await expect.poll(async () => page.evaluate(async () => {
    const response = await fetch("/api/auth/me/", { credentials: "include" });
    return response.status;
  }), {
    message: `Session browser ${username} belum aktif di backend.`,
    timeout: 15000,
  }).toBe(200);

  await page.addInitScript((user) => {
    window.localStorage.setItem("atl_current_user", JSON.stringify(user));
  }, body.user);
  await page.goto("/dashboard");
  await page.evaluate((user) => {
    window.localStorage.setItem("atl_current_user", JSON.stringify(user));
  }, body.user);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
  await expect(page.getByText(/monitoring sistem atl|dashboard pekerjaan guru|dashboard/i).first()).toBeVisible({ timeout: 15000 });
}

export async function logoutIfNeeded(page) {
  await page.evaluate(() => {
    window.localStorage.removeItem("atl_current_user");
  });
}
