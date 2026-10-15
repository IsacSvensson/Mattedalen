import { expect, test } from '@playwright/test';
import { answer, createProfile, enterGarden, nextStep, openParent, seedStates, switchPlayer } from './helpers';

const fluentTens = () => {
  const s: Record<string, { status: string; box: number }> = {};
  for (let n = 1; n <= 10; n++) s[`10x${n}`] = s[`${n}x10`] = { status: 'fluent', box: 3 };
  return s;
};

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
});

test('the record challenge opens once facts are fluent and only compares with yourself', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Alva');
  await expect(page.getByRole('button', { name: 'Slå rekord' })).toBeDisabled();

  await seedStates(page, fluentTens());
  await enterGarden(page, 'Alva');
  await page.getByRole('button', { name: 'Slå rekord' }).click();
  await expect(page.getByText('Första gången – sätt ett rekord!')).toBeVisible();
  await page.getByRole('button', { name: 'Kör!' }).click();

  for (let i = 0; i < 4; i++) {
    const text = (await page.locator('.question .prompt').textContent())!;
    const [a, b] = text.match(/\d+/g)!.map(Number) as [number, number];
    await page.keyboard.type(String(a * b));
    await page.keyboard.press('Enter');
    await expect(page.locator('.challenge-score')).toHaveText(String(i + 1));
  }
  await page.clock.fastForward('01:31');
  await expect(page.getByRole('heading', { name: '4 rätt!' })).toBeVisible();
  await expect(page.getByText('Ditt första rekord!')).toBeVisible();

  await page.getByRole('button', { name: 'Igen' }).click();
  await expect(page.getByText('Ditt rekord: 4')).toBeVisible();
});

test('two players: a child against a grown-up, seven rounds of multiplication war', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Bo');
  await page.getByRole('button', { name: 'Mot en vuxen' }).click();
  await page.getByRole('button', { name: 'Dra kort!' }).click();
  for (let round = 1; round <= 7; round++) {
    await expect(page.getByText('Bos tur')).toBeVisible();
    const child = (await page.locator('.duel-card').textContent())!.match(/\d+/g)!.map(Number);
    await page.locator('.choice', { hasText: new RegExp(`^${child[0]! * child[1]!}$`) }).click();
    await expect(page.getByText('Den vuxnas tur')).toBeVisible();
    const adult = (await page.locator('.duel-card').textContent())!.match(/\d+/g)!.map(Number);
    // The grown-up gets one wrong, on purpose.
    await page.keyboard.type(String(adult[0]! * adult[1]! + (round === 3 ? 1 : 0)));
    await page.keyboard.press('Enter');
    await expect(page.locator('.duel-message')).toBeVisible();
    if (round === 3) await expect(page.locator('.duel-reveal.adult')).toContainText('inte rätt');
    await page.getByRole('button', { name: round < 7 ? 'Nästa runda' : 'Se resultatet' }).click();
  }
  await expect(page.getByRole('heading', { name: /vann|Oavgjort/ })).toBeVisible();
  await expect(page.locator('.end-text')).toHaveText(/^\d+ – \d+$/);
});

test('questions can be read aloud in Swedish', async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { spoken: string[] }).spoken = spoken;
    class FakeUtterance {
      lang = '';
      rate = 1;
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [{ lang: 'sv-SE', name: 'Alva', localService: true }],
        speak: (u: FakeUtterance) => {
          spoken.push(`${u.lang}: ${u.text}`);
          setTimeout(() => u.onend?.(), 10);
        },
        cancel: () => undefined,
        addEventListener: () => undefined,
      },
    });
  });
  await page.goto('/');
  await createProfile(page, 'Alva');
  await switchPlayer(page);
  await openParent(page);
  await page.getByRole('checkbox', { name: /Läs upp frågorna/ }).check();
  await expect(page.locator('.voice-note')).toHaveText('');
  await page.getByRole('button', { name: 'Stäng föräldravyn' }).click();
  await enterGarden(page, 'Alva');
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  await expect(nextStep(page)).toBeVisible();
  await answer(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as { spoken: string[] }).spoken)).toEqual(
    // A new child starts with "Lika stora grupper", read as it stands.
    expect.arrayContaining([expect.stringMatching(/^sv-SE: \d+ korgar med \d+ jordgubbar i varje\. Hur många jordgubbar\?$/)]),
  );
  await expect(page.getByRole('button', { name: 'Läs upp igen' })).toBeVisible();
});

/** Read-aloud never uses a network voice: the text would leave the device. */
for (const local of [false, true]) {
  test(`read-aloud ${local ? 'uses the voice on the device' : 'stays silent with only a network voice'}`, async ({ page }) => {
    await page.addInitScript((withLocal) => {
      const spoken: string[] = [];
      (window as unknown as { spoken: string[] }).spoken = spoken;
      class FakeUtterance {
        lang = '';
        rate = 1;
        voice: { name: string } | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
      }
      const voices = [
        { lang: 'sv-SE', name: 'Google svenska', localService: false },
        ...(withLocal ? [{ lang: 'sv-SE', name: 'Alva', localService: true }] : []),
      ];
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance });
      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          getVoices: () => voices,
          speak: (u: FakeUtterance) => {
            spoken.push(`${u.voice?.name ?? 'standardröst'}: ${u.text}`);
            setTimeout(() => u.onend?.(), 10);
          },
          cancel: () => undefined,
          addEventListener: () => undefined,
        },
      });
    }, local);
    await page.goto('/');
    await createProfile(page, 'Alva');
    await switchPlayer(page);
    await openParent(page);
    await page.getByRole('checkbox', { name: /Läs upp frågorna/ }).check();
    if (local) await expect(page.locator('.voice-note')).toHaveText('');
    else await expect(page.locator('.voice-note')).toContainText('bara röster på enheten');
    await page.getByRole('button', { name: 'Stäng föräldravyn' }).click();
    await enterGarden(page, 'Alva');
    await page.getByRole('button', { name: 'Vattna trädgården' }).click();
    await answer(page);
    await answer(page);
    const spoken = () => page.evaluate(() => (window as unknown as { spoken: string[] }).spoken);
    if (local) {
      await expect.poll(spoken).toEqual(expect.arrayContaining([expect.stringMatching(/^Alva: /)]));
      await expect(page.getByRole('button', { name: 'Läs upp igen' })).toBeVisible();
    } else {
      // No button that could read aloud, and nothing read.
      await expect(page.getByRole('button', { name: 'Läs upp igen' })).toHaveCount(0);
      await page.waitForTimeout(2000);
      expect(await spoken()).toEqual([]);
    }
    expect((await spoken()).filter((s) => !s.startsWith('Alva: '))).toEqual([]);
  });
}
