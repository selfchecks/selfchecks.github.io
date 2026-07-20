import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

const root = process.cwd();
const rendererUrl = pathToFileURL(
  path.join(root, "tools/asset-renderer.html"),
).toString();

const assets = [
  {
    output: "assets/selfchecks-hero.png",
    selector: '[data-asset="hero"]',
    viewport: { height: 1500, width: 2400 },
    webpOutput: "assets/selfchecks-hero.webp",
    webpQuality: 0.82,
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

const requestedOutputs = new Set(process.argv.slice(2));
const assetsToRender = requestedOutputs.size
  ? assets.filter(
      (asset) =>
        requestedOutputs.has(asset.output) ||
        (asset.webpOutput && requestedOutputs.has(asset.webpOutput)),
    )
  : assets;

if (assetsToRender.length === 0) {
  throw new Error(`Unknown asset output: ${[...requestedOutputs].join(", ")}`);
}

const browser = await chromium.launch();

try {
  for (const asset of assetsToRender) {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: asset.viewport,
    });

    await page.goto(rendererUrl, { waitUntil: "load" });
    await page.locator(asset.selector).screenshot({
      animations: "disabled",
      path: path.join(root, asset.output),
    });

    if (asset.webpOutput) {
      const png = await readFile(path.join(root, asset.output));
      const webpBase64 = await page.evaluate(
        async ({ source, quality }) => {
          const image = new Image();
          image.src = source;
          await image.decode();

          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          canvas.getContext("2d")?.drawImage(image, 0, 0);

          return canvas.toDataURL("image/webp", quality).split(",")[1];
        },
        {
          quality: asset.webpQuality,
          source: `data:image/png;base64,${png.toString("base64")}`,
        },
      );

      await writeFile(
        path.join(root, asset.webpOutput),
        Buffer.from(webpBase64, "base64"),
      );
      console.log(`generated ${asset.webpOutput}`);
    }

    await page.close();

    console.log(`generated ${asset.output}`);
  }
} finally {
  await browser.close();
}
