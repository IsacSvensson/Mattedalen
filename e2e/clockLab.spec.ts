import { expect, test, type Page } from '@playwright/test';
import { createProfile, openParent, parentLink } from './helpers';

/** "Prova klockan", only in the test version (docs/PLAN-KLOCKAN.md, KL1). */

async function toDevice(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await createProfile(page, 'Alva', 'brook');
  await page.goto(path);
  await openParent(page);
  await parentLink(page, 'Den här enheten');
}

async function toLab(page: Page): Promise<void> {
  await toDevice(page, '/test/');
  await page.getByRole('button', { name: 'Prova klockan (bara i testversionen)' }).click();
  await expect(page.getByRole('heading', { name: 'Prova klockan', level: 1 })).toBeVisible();
}

/** Drags on the face through the given points, as minutes on the clock (0 is 12, 15 is 3, 30 is 6 …). */
async function dragThrough(page: Page, minutes: number[]): Promise<void> {
  await page.locator('.clock-setter').scrollIntoViewIfNeeded();
  const box = (await page.locator('.clock-setter').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const at = (m: number) => {
    const a = (m / 60) * 2 * Math.PI;
    return [cx + Math.sin(a) * box.width * 0.3, cy - Math.cos(a) * box.height * 0.3] as const;
  };
  const [x0, y0] = at(minutes[0]!);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (const m of minutes.slice(1)) {
    const [x, y] = at(m);
    await page.mouse.move(x, y, { steps: 6 });
  }
  await page.mouse.up();
}

test('the real app has no clock lab', async ({ page }) => {
  await toDevice(page, '/');
  await expect(page.getByRole('button', { name: /Prova klockan/ })).toHaveCount(0);
});

test('the faces: every look, quarters, minutes around the edge, only the hour hand, no numbers', async ({ page }) => {
  await toLab(page);
  const figures = page.locator('.lab-figure');
  await expect(figures).toHaveCount(8);
  await expect(page.getByRole('img', { name: 'Stationsklocka, halv fyra' }).locator('.clock-number')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Bara timvisaren, strax efter 3' }).locator('.clock-hand.minute')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Fjärdedelar, kvart över tre' }).locator('.clock-quarter')).toHaveCount(4);
  // Half past three: the hour hand halfway between 3 and 4.
  await expect(page.getByRole('img', { name: 'Vanlig, halv fyra' }).locator('.clock-hand.hour')).toHaveAttribute('transform', 'rotate(105.00 70 70)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('dragging the minute hand from 12 to 6 makes 3:30, and the hour hand goes along', async ({ page }) => {
  await toLab(page);
  const setter = page.locator('.clock-setter');
  await expect(setter).toHaveAttribute('aria-valuetext', 'Klockan 3:00');
  await dragThrough(page, [0, 10, 20, 30]);
  await expect(setter).toHaveAttribute('aria-valuetext', 'Klockan 3:30');
  await expect(setter.locator('.clock-hand.hour')).toHaveAttribute('transform', 'rotate(105.00 70 70)');
  await expect(page.getByRole('img', { name: 'Klockan 03:30' })).toBeVisible();
  // On round past 12: the next hour.
  await dragThrough(page, [30, 40, 50, 0, 5]);
  await expect(setter).toHaveAttribute('aria-valuetext', 'Klockan 4:05');
});

test('with steps of 30 minutes, a whole turn goes on to the next hour', async ({ page }) => {
  await toLab(page);
  await page.getByRole('combobox', { name: 'Minutvisaren snäpper' }).selectOption('30');
  const setter = page.locator('.clock-setter');
  await dragThrough(page, [0, 10, 20, 30]);
  await expect(setter).toHaveAttribute('aria-valuetext', 'Klockan 3:30');
  await dragThrough(page, [30, 40, 50, 0, 10]);
  await expect(setter).toHaveAttribute('aria-valuetext', 'Klockan 4:00');
  await dragThrough(page, [0, 10, 20, 30, 40, 50, 0, 10, 20, 30]);
  await expect(setter).toHaveAttribute('aria-valuetext', 'Klockan 5:30');
  // Backwards past 12: the hour before.
  await dragThrough(page, [30, 20, 10, 0, 50, 40, 30]);
  await expect(setter).toHaveAttribute('aria-valuetext', 'Klockan 4:30');
});

test('the arrow keys move the minute hand a step, and back past 12 is the hour before', async ({ page }) => {
  await toLab(page);
  const setter = page.locator('.clock-setter');
  await setter.focus();
  await page.keyboard.press('ArrowRight');
  await expect(setter).toHaveAttribute('aria-valuetext', 'Klockan 3:05');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(setter).toHaveAttribute('aria-valuetext', 'Klockan 2:55');
  await page.getByRole('combobox', { name: 'Minutvisaren snäpper' }).selectOption('15');
  await page.locator('.clock-setter').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.clock-setter')).toHaveAttribute('aria-valuetext', 'Klockan 3:15');
});

test('hands apart: the hour hand stays where the child puts it', async ({ page }) => {
  await toLab(page);
  await page.getByRole('checkbox', { name: 'Visarna var för sig' }).check();
  const setter = page.locator('.clock-setter.unlinked');
  await setter.focus();
  // The minute hand to 6: the hour hand stays on 3.
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await expect(setter.locator('.clock-hand.hour')).toHaveAttribute('transform', 'rotate(90.00 70 70)');
  await expect(setter).toHaveAttribute('data-hour-at', '3');
  // With Shift the hour hand moves, in eighths of an hour.
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight');
  await expect(setter).toHaveAttribute('data-hour-at', '3.5');
  await expect(setter.locator('.clock-hand.hour')).toHaveAttribute('transform', 'rotate(105.00 70 70)');
});

test('answers as clock faces carry their names', async ({ page }) => {
  await toLab(page);
  const choices = page.locator('.choices.pictures .choice');
  await expect(choices).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'halv fyra' })).toBeVisible();
  await page.getByRole('button', { name: 'kvart i fyra' }).click();
  await expect(page.getByRole('button', { name: 'kvart i fyra' })).toHaveClass(/chosen/);
});
