import assert from "node:assert/strict";
import { createServer } from "node:http";
import { stat } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const root = process.cwd();
const requiredFiles = [
  "index.html",
  "getting-started.html",
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
const browser = await chromium.launch();

try {
  for (const pageDefinition of [
    {
      minimumVerticalGaps: [],
      path: "/",
      requiredSelectors: ["h1", "#dashboard img", 'a[href="./getting-started.html"]'],
      title: "Selfchecks",
    },
    {
      minimumVerticalGaps: [
        ["#configuration > .docs-grid", "#configuration > .guide-note"],
        ["#deploy > .code-card:last-of-type", "#deploy > .guide-note"],
        ["#gitlab-ci > .code-card", "#gitlab-ci > .guide-note"],
        ["#github-ci > .code-card", "#github-ci > .guide-note"],
      ],
      path: "/getting-started.html",
      requiredSelectors: [
        "h1",
        "#project",
        "#http-api",
        "#gitlab-ci",
        "#github-ci",
        "#server",
      ],
      title: "Getting started with Selfchecks",
    },
  ]) {
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

      const response = await page.goto(`http://127.0.0.1:${port}${pageDefinition.path}`, {
        waitUntil: "networkidle",
      });
      assert.equal(response?.status(), 200, `${pageDefinition.path} should load`);
      assert.match(await page.title(), new RegExp(pageDefinition.title, "i"));

      for (const selector of pageDefinition.requiredSelectors) {
        await assert.doesNotReject(() => page.locator(selector).first().waitFor());
      }

      for (const [beforeSelector, afterSelector] of pageDefinition.minimumVerticalGaps) {
        const beforeBox = await page.locator(beforeSelector).boundingBox();
        const afterBox = await page.locator(afterSelector).boundingBox();
        assert(beforeBox, `${beforeSelector} should have a layout box`);
        assert(afterBox, `${afterSelector} should have a layout box`);
        assert(
          afterBox.y - (beforeBox.y + beforeBox.height) >= 12,
          `${beforeSelector} and ${afterSelector} should have a visible vertical gap`,
        );
      }

      assert.equal(errors.length, 0, `browser console errors: ${errors.join("; ")}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("page check passed");
