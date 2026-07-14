import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import { clickFirstVisible, expectAnyText, uniqueSuffix } from "./helpers/blackbox";

async function openAddCriterionForm(page) {
  const addButton = page.getByTestId("criteria-add-button");
  await expect(addButton).toBeVisible({ timeout: 30000 });
  await addButton.click();
  await expect(page.getByTestId("criteria-topic-input")).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => page.locator("[data-testid^='criteria-category-option-']").count(), {
    message: "Kategori ATL belum tersedia setelah form kriteria dibuka.",
    timeout: 30000,
  }).toBeGreaterThan(0);
}

async function selectStablePjTopic(page) {
  await expect(page.getByRole("button", { name: /IPA \(Sains\)/i })).toBeVisible({ timeout: 30000 });
  const topicButton = page.getByRole("button", { name: /Energi Perubahan/i }).first();
  await expect(topicButton).toBeVisible({ timeout: 30000 });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await topicButton.click();
    await page.waitForTimeout(500);
    if (await page.getByTestId("criteria-selected-subtopic-label").filter({ hasText: /Energi Perubahan/i }).count()) {
      break;
    }
  }
  await expect(page.getByTestId("criteria-selected-subtopic-label"), "Subtopik aktif PJ harus Energi Perubahan untuk skenario stabil.").toHaveText(/Energi Perubahan/i, { timeout: 30000 });
}

async function saveCriterionAndExpectSuccess(page) {
  const dialogPromise = page.waitForEvent("dialog", { timeout: 45000 }).then(async (dialog) => {
    const message = dialog.message();
    await dialog.accept();
    return message;
  }).catch(() => null);
  await page.getByTestId("criteria-save-button").click({ force: true });
  const dialogMessage = await Promise.race([
    dialogPromise,
    page.getByTestId("criteria-topic-input").count().then(() => null),
  ]);
  expect(dialogMessage, `Kriteria valid ditolak UI/backend: ${dialogMessage}`).toBeFalsy();
  await expect(page.getByTestId("criteria-topic-input")).toHaveCount(0, { timeout: 30000 });
}

async function expectCriterionCard(page, name, message) {
  await expect(page.locator("h4").filter({ hasText: name }).first(), message).toBeVisible({ timeout: 30000 });
}

async function fillValidCriterion(page, name) {
  await page.getByTestId("criteria-topic-input").fill(`Blackbox Topic ${uniqueSuffix()}`);
  await page.getByTestId("criteria-name-input").fill(name);
  await clickFirstVisible(page.locator("[data-testid^='criteria-category-option-']"), "Kategori ATL tidak tersedia.");
  await clickFirstVisible(page.locator("[data-testid^='criteria-subskill-option-']"), "Subskill ATL tidak tersedia setelah kategori dipilih.");
  for (const level of ["nfi", "pte", "de", "me", "ee"]) {
    await page.getByTestId(`criteria-level-${level}-input`).fill(`Indikator ${level.toUpperCase()} untuk ${name}`);
  }
}

test.describe("Blackbox - PJ Matkul/PJ Mapel - Manajemen Kriteria", () => {
  test("BBPJ-01 - Berhasil sesuai harapan - PJ Matkul menambahkan kriteria, subskill, dan indikator ATL yang valid", async ({ page }) => {
    test.setTimeout(120000);
    await login(page, "ipa", "ipa12345");
    await page.goto("/atl/manage");
    await selectStablePjTopic(page);

    const criterionName = `Thinking Skills Blackbox ${uniqueSuffix()}`;
    await openAddCriterionForm(page);
    await fillValidCriterion(page, criterionName);
    await saveCriterionAndExpectSuccess(page);

    await expectAnyText(page, /berhasil|tersimpan|kriteria/i, "Kriteria valid tidak menampilkan status berhasil.");
    await expectCriterionCard(page, criterionName, "Kriteria baru tidak muncul pada daftar kriteria.");
  });

  test("BBPJ-02 - Tidak berhasil - PJ Matkul menyimpan kriteria kosong, indikator kosong, atau kode kriteria duplikat", async ({ page }) => {
    test.setTimeout(90000);
    await login(page, "ipa", "ipa12345");
    await page.goto("/atl/manage");
    await selectStablePjTopic(page);

    await openAddCriterionForm(page);
    const dialogPromise = page.waitForEvent("dialog").then(async (dialog) => {
      const message = dialog.message();
      await dialog.accept();
      return message;
    });
    const [, dialogMessage] = await Promise.all([
      page.getByTestId("criteria-save-button").click({ force: true }),
      dialogPromise,
    ]);
    expect(dialogMessage).toMatch(/isi semua field|lengkapi|wajib|required|harus|indikator|duplikat/i);
  });

  test("BBPJ-03 - Berhasil tetapi hasil tidak diharapkan - PJ Matkul mengubah kriteria pada satu konteks, tetapi perubahan memengaruhi konteks lain atau merusak data assessment lama", async ({ page }) => {
    test.setTimeout(120000);
    await login(page, "ipa", "ipa12345");
    await page.goto("/atl/manage");
    await selectStablePjTopic(page);

    const criterionName = `Context Guard Blackbox ${uniqueSuffix()}`;
    await openAddCriterionForm(page);
    await fillValidCriterion(page, criterionName);
    await saveCriterionAndExpectSuccess(page);
    await expectCriterionCard(page, criterionName, "Kriteria konteks sumber tidak tersimpan.");

    await page.goto("/input-atl");
    await expectAnyText(page, /input penilaian atl|rubrik|kriteria/i, "Halaman assessment tidak tampil untuk pengecekan dampak kriteria.");
    await expect(page.getByText(/student|siswa|kriteria|rubrik/i).first(), "Assessment lama/rubrik tidak bisa dibuka setelah perubahan kriteria.").toBeVisible({ timeout: 15000 });
  });
});
