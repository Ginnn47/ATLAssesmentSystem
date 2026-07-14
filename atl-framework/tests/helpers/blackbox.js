import { expect } from "@playwright/test";

export const uniqueSuffix = () => Date.now().toString().slice(-6);

export async function selectFirstAvailableOption(selectLocator) {
  await expect(selectLocator).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => selectLocator.evaluate((select) =>
    Array.from(select.options || []).filter((item) => item.value && !item.disabled).length
  ).catch(() => 0), {
    message: "Select belum memiliki option valid dari backend.",
    timeout: 30000,
  }).toBeGreaterThan(0);
  const value = await selectLocator.evaluate((select) => {
    const options = Array.from(select.options || []);
    const option = options.find((item) => item.value && !item.disabled);
    if (!option) return "";
    return option.value;
  });
  expect(value, "Select tidak memiliki option valid untuk skenario blackbox.").toBeTruthy();
  await selectLocator.selectOption(value);
  return value;
}

export async function selectOptionContaining(selectLocator, text) {
  await expect(selectLocator).toBeVisible({ timeout: 15000 });
  const optionLocator = selectLocator.locator("option").filter({ hasText: new RegExp(text, "i") }).first();
  await expect.poll(async () => optionLocator.count(), {
    message: `Option ${text} belum tersedia dari backend.`,
    timeout: 30000,
  }).toBeGreaterThan(0);
  const value = (await optionLocator.getAttribute("value")) ?? (await optionLocator.innerText());
  expect(value, `Option ${text} tidak ditemukan.`).toBeTruthy();
  await selectLocator.selectOption(value);
  return value;
}

export async function clickAssessmentTopicContaining(page, text) {
  const topic = page.locator("[data-testid^='assessment-topic-option-']").filter({ hasText: new RegExp(text, "i") }).first();
  await expect(topic, `Topik ${text} belum tersedia.`).toBeVisible({ timeout: 30000 });
  await expect(topic, `Topik ${text} belum aktif/dapat dinilai.`).toBeEnabled({ timeout: 30000 });
  await topic.click();
}

export async function clickFirstVisible(locator, message) {
  await expect.poll(async () => locator.count(), {
    message,
    timeout: 30000,
  }).toBeGreaterThan(0);
  const count = await locator.count();
  expect(count, message).toBeGreaterThan(0);
  await locator.first().click();
}

export async function expectAnyText(page, pattern, message) {
  await expect(page.getByText(pattern).first(), message).toBeVisible({ timeout: 15000 });
}

export async function fillVisibleAssessmentRubric(page) {
  const preferred = page.getByTestId("rubric-item-ME");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await preferred.count()) {
      try {
        await preferred.first().click({ force: true, timeout: 5000 });
        return;
      } catch (error) {
        if (attempt === 4) throw error;
        await page.waitForTimeout(250);
      }
    }
  }
  const fallback = page.locator("[data-testid^='rubric-item-']");
  await clickFirstVisible(fallback, "Tidak ada pilihan rubrik ATL yang terlihat untuk diisi.");
}

export async function fillAllReachableAssessmentRubrics(page, maxSteps = 12) {
  for (let index = 0; index < maxSteps; index += 1) {
    await fillVisibleAssessmentRubric(page);
    const nextButtons = page.getByRole("button", { name: /kriteria berikutnya/i });
    if (!(await nextButtons.count())) break;
    const nextButton = nextButtons.last();
    if (await nextButton.isDisabled()) break;
    await nextButton.click();
  }
}

export async function chooseFirstPairwiseOptions(page) {
  const pairBlocks = page.locator("[id^='pairwise-']");
  await expect.poll(async () => pairBlocks.count(), {
    message: "Pairwise comparison belum tersedia untuk skenario Fuzzy-AHP.",
    timeout: 30000,
  }).toBeGreaterThan(0);
  const count = await pairBlocks.count();
  expect(count, "Pairwise comparison belum tersedia untuk skenario Fuzzy-AHP.").toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const block = pairBlocks.nth(index);
    const option = block
      .locator("[data-testid^='pairwise-option-'], button")
      .filter({ hasText: /equal|moderate|importance|sama|sedang|penting/i })
      .first();
    if (await option.count()) await option.click();
  }
}
