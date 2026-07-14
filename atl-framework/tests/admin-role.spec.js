import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import { expectAnyText, uniqueSuffix } from "./helpers/blackbox";

const createUser = async (page, payload) => {
  const response = await page.request.post("/api/users/", { data: payload });
  return response;
};

test.describe("Blackbox - Admin Akademik - Role dan Akses", () => {
  test("BBAD-01 - Berhasil sesuai harapan - Admin membuat akun baru, memilih role, dan user login sesuai role tersebut", async ({ page }) => {
    await login(page, "admin", "admin12345");

    const suffix = uniqueSuffix();
    const username = `guru_bb_${suffix}`;
    const password = "Guru12345";
    const response = await createUser(page, {
      username,
      name: "Guru Blackbox Automation",
      email: `${username}@test.local`,
      password,
      roles: ["ROLE_EVALUATOR", "ROLE_HOMEROOM"],
      roleCodes: ["ROLE_EVALUATOR", "ROLE_HOMEROOM"],
      classAccess: ["3A"],
      subjectAccess: ["singing"],
      status: "Aktif",
    });
    expect(response.status(), await response.text()).toBe(201);

    await login(page, username, password);
    await expectAnyText(page, /dashboard pekerjaan guru|dashboard/i, "User baru tidak bisa login sesuai role yang dipilih.");
    await page.goto("/students");
    await expectAnyText(page, /student management|stud manage|data siswa|siswa/i, "User role Wali Kelas tidak melihat fitur sesuai role.");
  });

  test("BBAD-02 - Tidak berhasil - Admin membuat user dengan email kosong, email duplikat, password tidak valid, atau role belum dipilih", async ({ page }) => {
    await login(page, "admin", "admin12345");

    const suffix = uniqueSuffix();
    const response = await createUser(page, {
      username: `invalid_bb_${suffix}`,
      name: "Invalid Blackbox User",
      email: "",
      password: "123",
      roles: [],
      roleCodes: [],
      status: "Aktif",
    });
    expect(response.status(), `Sistem seharusnya menolak user tanpa role/email/password valid. Response: ${await response.text()}`).toBeGreaterThanOrEqual(400);
  });

  test("BBAD-03 - Berhasil tetapi hasil tidak diharapkan - Admin memberi role Guru, tetapi user bisa mengakses fitur Admin/ATL Expert; atau akun nonaktif masih bisa login", async ({ page }) => {
    test.setTimeout(120000);
    await login(page, "admin", "admin12345");

    const suffix = uniqueSuffix();
    const guruUsername = `guru_guard_${suffix}`;
    const guruPassword = "Guru12345";
    const inactiveUsername = `inactive_bb_${suffix}`;
    const inactivePassword = "Inactive12345";

    const guruResponse = await createUser(page, {
      username: guruUsername,
      name: "Guru Guard Blackbox",
      email: `${guruUsername}@test.local`,
      password: guruPassword,
      roles: ["ROLE_EVALUATOR"],
      roleCodes: ["ROLE_EVALUATOR"],
      status: "Aktif",
    });
    expect(guruResponse.status(), await guruResponse.text()).toBe(201);

    const inactiveResponse = await createUser(page, {
      username: inactiveUsername,
      name: "Inactive Blackbox User",
      email: `${inactiveUsername}@test.local`,
      password: inactivePassword,
      roles: ["ROLE_EVALUATOR"],
      roleCodes: ["ROLE_EVALUATOR"],
      status: "Nonaktif",
    });
    expect(inactiveResponse.status(), await inactiveResponse.text()).toBe(201);

    await login(page, guruUsername, guruPassword);
    await page.goto("/academic/manage");
    await expect(page).toHaveURL(/unauthorized|\/$/);
    await expectAnyText(page, /akses ditolak|unauthorized|tidak memiliki akses|masuk/i, "Guru masih bisa mengakses fitur Admin.");

    const inactiveLogin = await page.request.post("/api/auth/login/", {
      data: { username: inactiveUsername, password: inactivePassword },
    });
    expect([400, 401, 403], `Akun nonaktif masih bisa login atau backend error. Response: ${await inactiveLogin.text()}`).toContain(inactiveLogin.status());
  });
});
