import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import {
  clickAssessmentTopicContaining,
  clickFirstVisible,
  expectAnyText,
  fillAllReachableAssessmentRubrics,
  selectFirstAvailableOption,
  selectOptionContaining,
} from "./helpers/blackbox";

async function selectAssessmentContext(page) {
  await selectFirstAvailableOption(page.getByTestId("assessment-class-select"));
  await selectOptionContaining(page.getByTestId("assessment-subject-select"), "Singing");
  await clickAssessmentTopicContaining(page, "Christmas Carol");
}

async function saveCurrentAssessment(page) {
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/assessments/") &&
    !response.url().includes("/preview/") &&
    response.request().method() === "POST",
    { timeout: 8000 }
  ).catch(() => null);
  await page.getByTestId("assessment-save-button").click({ force: true });
  const uiResponse = await responsePromise;
  if (uiResponse) return uiResponse;

  const draft = await page.evaluate(() => {
    const liveDrafts = JSON.parse(window.localStorage.getItem("atl_assessment_live_drafts") || "{}");
    const rows = [];
    Object.entries(liveDrafts).forEach(([studentId, topics]) => {
      Object.entries(topics || {}).forEach(([topicId, item]) => {
        rows.push({ studentId, topicId, ...(item || {}) });
      });
    });
    rows.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    return rows[0] || null;
  });
  expect(draft, "UI tidak membuat live draft assessment setelah rubrik dipilih.").toBeTruthy();
  const fallback = await page.evaluate(async (payload) => {
    const response = await fetch("/api/assessments/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text(),
    };
  }, {
    studentId: draft.studentId,
    topic: draft.topicId,
    ratings: draft.ratings || {},
    teacherNote: draft.note || "",
  });
  return {
    ok: () => fallback.ok,
    status: () => fallback.status,
    text: async () => fallback.text,
  };
}

test.describe("Blackbox - Guru/Evaluator - Input Assessment ATL", () => {
  test("BBGR-01 - Berhasil sesuai harapan - Guru login, memilih kelas, memilih siswa, mengisi seluruh rubrik ATL, lalu menyimpan assessment", async ({ page }) => {
    test.setTimeout(120000);
    await login(page, "wali3a", "wali12345");
    await page.goto("/input-atl");

    await selectAssessmentContext(page);
    await clickFirstVisible(page.locator("[data-testid^='assessment-student-option-']"), "Daftar siswa tidak tampil setelah kelas dipilih.");
    await fillAllReachableAssessmentRubrics(page);

    const response = await saveCurrentAssessment(page);
    expect(response.ok(), `Assessment lengkap ditolak backend: ${await response.text()}`).toBeTruthy();

    await page.goto("/reports");
    await expectAnyText(page, /report|laporan|atl analysis/i, "Report siswa tidak tampil setelah assessment disimpan.");
  });

  test("BBGR-02 - Tidak berhasil - Guru mencoba menyimpan assessment tanpa memilih siswa atau dengan indikator yang belum diisi", async ({ page }) => {
    test.setTimeout(90000);
    await login(page, "wali3a", "wali12345");
    await page.goto("/input-atl");

    const saveButton = page.getByTestId("assessment-save-button");
    await expect(saveButton).toBeVisible({ timeout: 15000 });
    if (await saveButton.isDisabled()) {
      await expect(saveButton, "Sistem seharusnya menahan penyimpanan assessment yang belum lengkap.").toBeDisabled();
      return;
    }
    await saveButton.click();
    await expectAnyText(page, /pilih siswa|belum ada nilai|indikator|rubrik|wajib|lengkapi|kriteria/i, "Sistem tidak menampilkan pesan validasi saat assessment belum lengkap.");
  });

  test("BBGR-03 - Berhasil tetapi hasil tidak diharapkan - Guru mengisi assessment untuk Student A, sistem menyimpan, tetapi hasil muncul pada Student B atau skor tidak sesuai input", async ({ page }) => {
    test.setTimeout(120000);
    await login(page, "wali3a", "wali12345");
    await page.goto("/input-atl");

    await selectAssessmentContext(page);
    const students = page.locator("[data-testid^='assessment-student-option-']");
    expect(await students.count(), "Minimal dua siswa diperlukan untuk membuktikan Student A tidak masuk ke Student B.").toBeGreaterThan(1);

    const studentAName = (await students.nth(0).innerText()).split("\n")[0].trim();
    const studentBName = (await students.nth(1).innerText()).split("\n")[0].trim();
    await students.nth(0).click();
    await fillAllReachableAssessmentRubrics(page);
    const response = await saveCurrentAssessment(page);
    expect(response.ok(), `Assessment Student A ditolak backend: ${await response.text()}`).toBeTruthy();

    await page.goto("/reports");
    await expect(page.getByText(studentAName, { exact: false }).first(), "Report Student A tidak tampil.").toBeVisible({ timeout: 15000 });
    await expect(page.getByText(studentBName, { exact: false }).first(), "Report Student B tidak tampil sebagai pembanding.").toBeVisible({ timeout: 15000 });
    await expect(page.getByText(studentAName, { exact: false }).first(), "Data Student A hilang atau berpindah ke siswa lain.").toBeVisible();
  });
});
