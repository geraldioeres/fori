import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function samplePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText('Application form', { x: 50, y: 740, size: 22, font, color: rgb(0, 0, 0) });
  page.drawText('Full name:', { x: 50, y: 690, size: 12, font });
  doc.addPage([612, 792]);
  return Buffer.from(await doc.save());
}

test('upload → place a text field → download a fillable PDF', async ({ page }) => {
  await page.goto('/');
  // Start clean even if a previous run autosaved a session.
  await page.evaluate(() => indexedDB.deleteDatabase('keyval-store'));
  await page.reload();

  await page.getByTestId('file-input').setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: await samplePdf() });
  const overlay = page.getByTestId('page-overlay-0');
  await expect(overlay).toBeVisible();

  // The page itself must be rendered by pdf.js (dark text pixels on the canvas).
  await expect
    .poll(() =>
      page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>('#page-0 canvas')!;
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let dark = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && d[i] < 100) dark++;
        return dark;
      }),
    )
    .toBeGreaterThan(100);

  // Place a text field by clicking the tool, then the page.
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await overlay.click({ position: { x: 150, y: 95 } });
  await expect(page.getByTestId('field')).toHaveCount(1);

  // Rename it in the properties panel.
  const name = page.getByLabel('Field properties').getByRole('textbox').first();
  await name.fill('full_name');

  // Place a checkbox too, then undo and redo it.
  await page.getByRole('button', { name: 'Checkbox', exact: true }).click();
  await overlay.click({ position: { x: 60, y: 140 } });
  await expect(page.getByTestId('field')).toHaveCount(2);
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('field')).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByTestId('field')).toHaveCount(2);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('sample-form.pdf');

  const out = await PDFDocument.load(await readFile(await download.path()));
  const fields = out.getForm().getFields();
  expect(fields.map((f) => f.getName()).sort()).toEqual(['checkbox_1', 'full_name']);
  const rect = out.getForm().getTextField('full_name').acroField.getWidgets()[0].getRectangle();
  // Clicked at (150, 95) CSS px at 100% zoom = top-left of the field in points.
  expect(rect.x).toBeCloseTo(150, 0);
  expect(792 - (rect.y + rect.height)).toBeCloseTo(95, 0);
});
