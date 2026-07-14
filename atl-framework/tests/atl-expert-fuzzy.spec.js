import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import { chooseFirstPairwiseOptions, expectAnyText } from "./helpers/blackbox";

const firstTfnInputs = (page) => ({
  lower: page.locator("[data-testid$='-lower-input']").first(),
  middle: page.locator("[data-testid$='-middle-input']").first(),
  upper: page.locator("[data-testid$='-upper-input']").first(),
});

async function selectOptionContaining(selectLocator, text) {
  await expect(selectLocator).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => selectLocator.evaluate((select, expectedText) => {
    return Array.from(select.options || []).some((option) =>
      option.textContent.toLowerCase().includes(expectedText.toLowerCase())
    );
  }, text).catch(() => false), {
    message: `Option ${text} belum tersedia.`,
    timeout: 30000,
  }).toBeTruthy();
  const value = await selectLocator.evaluate((select, expectedText) => {
    const option = Array.from(select.options || []).find((item) =>
      item.textContent.toLowerCase().includes(expectedText.toLowerCase())
    );
    return option?.value || "";
  }, text);
  await selectLocator.selectOption(value);
}

async function selectWeightContext(page) {
  const subjectSelect = page.getByTestId("weight-subject-select");
  if (!(await subjectSelect.count())) return;
  await selectOptionContaining(subjectSelect, "Singing");
  await selectOptionContaining(page.getByTestId("weight-topic-select"), "Christmas Carol");
  await expect.poll(async () => page.locator("[data-testid^='weight-criterion-package-']").count(), {
    message: "Criterion package untuk Singing / Christmas Carol belum selesai dimuat.",
    timeout: 30000,
  }).toBeGreaterThan(0);
}

async function openPairwiseStep(page) {
  const { lower } = firstTfnInputs(page);
  if (await lower.count()) return;
  const nextButton = page.getByRole("button", { name: /lanjutkan/i });
  await expect(nextButton, "Tombol Lanjutkan ke Pairwise tidak tersedia.").toBeEnabled({ timeout: 30000 });
  await nextButton.click();
  await expect(firstTfnInputs(page).lower, "Input TFN lower tidak tersedia setelah masuk Step 2.").toBeVisible({ timeout: 30000 });
}

test.describe("Blackbox - ATL Expert - Pembobotan Fuzzy-AHP", () => {
  test("BBAE-01 - Berhasil sesuai harapan - ATL Expert mengisi TFN valid, pairwise comparison lengkap, memproses Fuzzy-AHP, lalu menyimpan bobot final", async ({ page }) => {
    test.setTimeout(120000);
    await login(page, "rionaldus", "rionaldus123");
    await page.goto("/atl/weight");
    await selectWeightContext(page);
    await openPairwiseStep(page);

    await expect(firstTfnInputs(page).lower, "Input TFN lower tidak tersedia.").toBeVisible({ timeout: 15000 });

    await chooseFirstPairwiseOptions(page);
    await expect(page.getByTestId("fuzzy-process-button"), "Tombol proses Fuzzy-AHP belum aktif setelah pairwise lengkap.").toBeEnabled({ timeout: 15000 });
    await page.getByTestId("fuzzy-process-button").click();
    const resultButton = page.getByRole("button", { name: /lihat result/i });
    await expect(resultButton, "Hasil bobot Fuzzy-AHP belum selesai dihitung.").toBeVisible({ timeout: 30000 });

    const warningAcknowledgement = page.getByTestId("fuzzy-warning-acknowledgement");
    let acknowledgedWarning = false;
    if (await warningAcknowledgement.count()) {
      await warningAcknowledgement.check({ force: true });
      acknowledgedWarning = true;
    } else {
      const warningCheckbox = page.getByRole("checkbox", { name: /saya sudah meninjau warning/i });
      if (await warningCheckbox.count()) {
        await warningCheckbox.check({ force: true });
        acknowledgedWarning = true;
      } else {
        const warningLabel = page.locator("label").filter({ hasText: /saya sudah meninjau warning/i }).first();
        if (await warningLabel.count()) {
          await warningLabel.click();
          acknowledgedWarning = true;
        }
      }
    }
    if (acknowledgedWarning) {
      await expect(page.getByRole("checkbox", { name: /saya sudah meninjau warning/i })).toBeChecked();
    }

    await expect(resultButton, "Tombol Result belum aktif setelah hasil bobot valid ditinjau.").toBeEnabled({ timeout: 15000 });
    await resultButton.click();
    await expect(page.getByTestId("fuzzy-save-weight-button"), "Tombol simpan bobot belum aktif setelah bobot valid dihitung.").toBeEnabled({ timeout: 15000 });
    await page.getByTestId("fuzzy-save-weight-button").click();
    await expectAnyText(page, /tersimpan|berhasil|bobot/i, "Bobot final tidak menampilkan status berhasil tersimpan.");
  });

  test("BBAE-02 - Tidak berhasil - ATL Expert mengisi TFN tidak valid atau pairwise belum lengkap", async ({ page }) => {
    await login(page, "rionaldus", "rionaldus123");
    await page.goto("/atl/weight");
    await selectWeightContext(page);
    await openPairwiseStep(page);

    const { lower, middle, upper } = firstTfnInputs(page);
    await expect(lower, "Input TFN lower tidak tersedia.").toBeVisible({ timeout: 15000 });
    await lower.fill("5");
    await middle.fill("3");
    await upper.fill("1");
    await expect(page.getByTestId("tfn-save-button"), "Sistem tidak menonaktifkan simpan TFN invalid.").toBeDisabled();
    await expectAnyText(page, /scale belum valid|lower <= middle <= upper|valid/i, "Validasi TFN invalid tidak tampil.");
  });

  test("BBAE-03 - Berhasil tetapi hasil tidak diharapkan - Sistem berhasil menyimpan bobot meskipun hasil tidak ternormalisasi, kosong, negatif, atau tidak valid", async ({ page }) => {
    await login(page, "rionaldus", "rionaldus123");
    await page.goto("/atl/weight");
    await selectWeightContext(page);
    await openPairwiseStep(page);

    await expect(page.getByTestId("fuzzy-process-button"), "Proses bobot kosong seharusnya belum bisa dijalankan.").toBeDisabled({ timeout: 15000 });
  });
});
