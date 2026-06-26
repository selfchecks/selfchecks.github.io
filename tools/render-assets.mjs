import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

const root = process.cwd();
const rendererUrl = pathToFileURL(path.join(root, "tools/asset-renderer.html")).toString();

const assets = [
  {
    output: "assets/selfchecks-hero.png",
    selector: '[data-asset="hero"]',
    viewport: { height: 1500, width: 2400 },
  },
  {
    output: "assets/selfchecks-dashboard.png",
    selector: '[data-asset="dashboard"]',
    viewport: { height: 1000, width: 1600 },
  },
  {
    output: "og-card.png",
    selector: '[data-asset="og"]',
    viewport: { height: 630, width: 1200 },
  },
  {
    output: "apple-touch-icon.png",
    selector: '[data-asset="icon"]',
    viewport: { height: 180, width: 180 },
  },
];

const browser = await chromium.launch();

try {
  for (const asset of assets) {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: asset.viewport,
    });

    await page.goto(rendererUrl, { waitUntil: "load" });
    await page
      .locator(asset.selector)
      .screenshot({ animations: "disabled", path: path.join(root, asset.output) });
    await page.close();

    console.log(`generated ${asset.output}`);
  }
} finally {
  await browser.close();
}
