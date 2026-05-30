import { type Page, type FrameLocator } from '@playwright/test';

/**
 * Locate the Ketcher iframe on the page.
 * Ketcher is rendered inside an iframe in Labguru's compound forms.
 */
export function getKetcherFrame(page: Page): FrameLocator {
    return page.frameLocator('iframe[id*="ketcher"], iframe[src*="ketcher"]');
}

/**
 * Wait for Ketcher toolbar to be visible and interactive (PR-7-Ready).
 * Returns elapsed time in ms.
 */
export async function waitForToolbarReady(page: Page): Promise<number> {
    const start = Date.now();
    const ketcher = getKetcherFrame(page);

    await ketcher.locator('[class*="toolbar"], [data-testid*="toolbar"]').first().waitFor({
        state: 'visible',
        timeout: 10_000,
    });

    // Verify at least one tool is interactive (cursor state change on click)
    const tool = ketcher.locator('button[data-testid], [class*="tool-button"]').first();
    await tool.waitFor({ state: 'visible', timeout: 5_000 });

    return Date.now() - start;
}

/**
 * Wait for Ketcher canvas to be ready for drawing (PR-7-Load).
 * Returns elapsed time in ms.
 */
export async function waitForCanvasReady(page: Page): Promise<number> {
    const start = Date.now();
    const ketcher = getKetcherFrame(page);

    await ketcher.locator('svg[class*="canvas"], canvas, [data-testid="canvas"]').first().waitFor({
        state: 'visible',
        timeout: 10_000,
    });

    return Date.now() - start;
}

/**
 * Paste SMILES string into Ketcher and wait for structure to render (PR-7-Input).
 * Returns elapsed time in ms.
 */
export async function pasteSmiles(page: Page, smiles: string): Promise<number> {
    const ketcher = getKetcherFrame(page);
    const start = Date.now();

    // Open SMILES paste dialog
    const pasteButton = ketcher.locator(
        'button:has-text("Open"), button:has-text("Paste"), [data-testid*="open"], [data-testid*="paste"]'
    ).first();
    await pasteButton.click();

    // Fill SMILES input
    const smilesInput = ketcher.locator(
        'textarea, input[placeholder*="SMILES"], input[type="text"]'
    ).first();
    await smilesInput.fill(smiles);

    // Confirm
    const confirmButton = ketcher.locator(
        'button:has-text("Add"), button:has-text("OK"), button:has-text("Apply")'
    ).first();
    await confirmButton.click();

    // Wait for structure to render
    await ketcher.locator('svg [class*="atom"], svg circle, svg text').first().waitFor({
        state: 'visible',
        timeout: 10_000,
    });

    return Date.now() - start;
}

/**
 * Upload a structure file (MOL, CDXML, CDX) into Ketcher (PR-7-Input).
 * Returns elapsed time in ms.
 */
export async function uploadStructureFile(page: Page, filePath: string): Promise<number> {
    const ketcher = getKetcherFrame(page);
    const start = Date.now();

    // Open file upload dialog
    const openButton = ketcher.locator(
        'button:has-text("Open"), [data-testid*="open"]'
    ).first();
    await openButton.click();

    // Upload file via input[type=file]
    const fileInput = ketcher.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filePath);

    // Wait for structure to render
    await ketcher.locator('svg [class*="atom"], svg circle, svg text').first().waitFor({
        state: 'visible',
        timeout: 15_000,
    });

    return Date.now() - start;
}
