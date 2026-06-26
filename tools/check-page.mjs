import assert from "node:assert/strict";
import { createServer } from "node:http";
import { stat } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const root = process.cwd();
const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "favicon.svg",
  "apple-touch-icon.png",
  "og-card.png",
  "assets/selfchecks-hero.png",
  "assets/selfchecks-dashboard.png",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
];

for (const file of requiredFiles) {
  const fileStat = await stat(path.join(root, file));
  assert(fileStat.size > 0, `${file} should not be empty`);
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const target = path.join(root, pathname);

  try {
    const file = await import("node:fs/promises").then(({ readFile }) => readFile(target));
    const ext = path.extname(target);
    const contentType =
      ext === ".css"
        ? "text/css"
        : ext === ".js"
          ? "text/javascript"
          : ext === ".svg"
            ? "image/svg+xml"
            : ext === ".png"
              ? "image/png"
              : ext === ".xml"
                ? "application/xml"
                : "text/html";

    response.writeHead(200, { "content-type": contentType });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", resolve);
});

const { port } = server.address();
const url = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch();

try {
  for (const viewport of [
    { height: 900, width: 1440 },
    { height: 812, width: 390 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(url, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, "home page should load");
    await assert.doesNotReject(() => page.locator("h1", { hasText: "Selfchecks" }).waitFor());
    await assert.doesNotReject(() => page.locator("#dashboard img").waitFor());
    assert.equal(errors.length, 0, `browser console errors: ${errors.join("; ")}`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("page check passed");
