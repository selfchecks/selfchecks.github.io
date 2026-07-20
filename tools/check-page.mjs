import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
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
  "assets/selfchecks-hero.webp",
  "assets/selfchecks-dashboard.png",
  "assets/product-dashboard.webp",
  "assets/product-test-sessions.webp",
  "assets/product-usage.webp",
  "assets/product-check-detail.webp",
  "assets/product-run-detail.webp",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
];

for (const file of requiredFiles) {
  const fileStat = await stat(path.join(root, file));
  assert(fileStat.size > 0, `${file} should not be empty`);
}

const htmlPages = [
  {
    canonical: "https://selfchecks.github.io/",
    file: "index.html",
    structuredTypes: [
      "FAQPage",
      "Organization",
      "SoftwareApplication",
      "WebPage",
      "WebSite",
    ],
  },
  {
    canonical: "https://selfchecks.github.io/getting-started.html",
    file: "getting-started.html",
    structuredTypes: [
      "BreadcrumbList",
      "Organization",
      "SoftwareApplication",
      "TechArticle",
      "WebSite",
    ],
  },
];

for (const { canonical, file, structuredTypes } of htmlPages) {
  const source = await readFile(path.join(root, file), "utf8");
  const description = source.match(
    /<meta\s+name="description"\s+content="([^"]+)"/,
  )?.[1];
  assert(description, `${file} should have a meta description`);
  assert(
    description.length <= 170,
    `${file} meta description should be concise`,
  );
  assert(
    source.includes('rel="canonical"') &&
      source.includes(`href="${canonical}"`),
    `${file} should have the expected canonical URL`,
  );
  assert.match(
    source,
    /<meta\s+name="robots"\s+content="index,follow,/,
    `${file} should explicitly allow indexing`,
  );
  assert.match(
    source,
    /<link\s+rel="alternate"\s+type="text\/plain"\s+href="https:\/\/selfchecks\.github\.io\/llms\.txt"/,
    `${file} should link to LLM context`,
  );
  assert.doesNotMatch(
    source,
    /<meta\s+name="keywords"/,
    `${file} should not use obsolete meta keywords`,
  );
  assert.match(source, /property="og:image:alt"/, `${file} needs OG image alt`);
  assert.match(
    source,
    /name="twitter:image:alt"/,
    `${file} needs Twitter image alt`,
  );

  const structuredDataScripts = [
    ...source.matchAll(
      /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ];
  assert(
    structuredDataScripts.length > 0,
    `${file} should include JSON-LD structured data`,
  );

  const structuredTypesFound = new Set();
  const structuredEntities = [];
  for (const [, json] of structuredDataScripts) {
    const structuredData = JSON.parse(json);
    assert.equal(
      structuredData["@context"],
      "https://schema.org",
      `${file} should use the Schema.org context`,
    );

    for (const entity of structuredData["@graph"] ?? [structuredData]) {
      structuredTypesFound.add(entity["@type"]);
      structuredEntities.push(entity);
    }
  }

  for (const type of structuredTypes) {
    assert(
      structuredTypesFound.has(type),
      `${file} structured data should include ${type}`,
    );
  }

  if (file === "index.html") {
    assert.match(
      source,
      /<source srcset="\.\/assets\/selfchecks-hero\.webp" type="image\/webp"/,
      "index.html should serve the optimized hero image",
    );

    const faq = structuredEntities.find(
      (entity) => entity["@type"] === "FAQPage",
    );
    assert(faq, "index.html should describe its visible FAQ");
    for (const question of faq.mainEntity) {
      assert(
        source.includes(`<h3>${question.name}</h3>`),
        `FAQ structured data should match visible question: ${question.name}`,
      );
    }
  }

  if (file === "getting-started.html") {
    const article = structuredEntities.find(
      (entity) => entity["@type"] === "TechArticle",
    );
    assert.equal(article.datePublished, "2026-07-16");
    assert.equal(article.dateModified, "2026-07-20");
    assert.equal(article.image, "https://selfchecks.github.io/og-card.png");
  }

  assert.match(
    source,
    /ym\(110846589, "init",/,
    `${file} should initialize Yandex Metrika`,
  );
  assert.match(
    source,
    /https:\/\/mc\.yandex\.ru\/watch\/110846589/,
    `${file} should include the Yandex Metrika noscript fallback`,
  );
}

const [robots, sitemap, llms] = await Promise.all([
  readFile(path.join(root, "robots.txt"), "utf8"),
  readFile(path.join(root, "sitemap.xml"), "utf8"),
  readFile(path.join(root, "llms.txt"), "utf8"),
]);

assert.match(robots, /User-agent: \*/);
assert.match(robots, /Allow: \//);
assert.match(robots, /Sitemap: https:\/\/selfchecks\.github\.io\/sitemap\.xml/);

for (const { canonical } of htmlPages) {
  assert(
    sitemap.includes(`<loc>${canonical}</loc>`),
    `sitemap.xml should include ${canonical}`,
  );
  assert(llms.includes(canonical), `llms.txt should include ${canonical}`);
}

assert.match(llms, /^# Selfchecks$/m);
assert.match(llms, /^> Selfchecks is /m);
assert.match(llms, /not OSI-approved open\s+source/i);

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname =
    requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const target = path.join(root, pathname);

  try {
    const file = await import("node:fs/promises").then(({ readFile }) =>
      readFile(target),
    );
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
              : ext === ".webp"
                ? "image/webp"
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
      requiredSelectors: [
        "h1",
        "#create-selfchecks-command",
        ".hero-backdrop picture img",
        '#dashboard img[src="./assets/product-dashboard.webp"]',
        ".product-tour-grid img",
        'a[href="./getting-started.html"]',
        ".hero-license",
        "#faq h3",
        'a[href="https://github.com/selfchecks/selfchecks/blob/stable/LICENSE"]',
      ],
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
        ".docs-screenshot img",
        "#migration",
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

      const response = await page.goto(
        `http://127.0.0.1:${port}${pageDefinition.path}`,
        {
          waitUntil: "networkidle",
        },
      );
      assert.equal(
        response?.status(),
        200,
        `${pageDefinition.path} should load`,
      );
      assert.match(await page.title(), new RegExp(pageDefinition.title, "i"));
      assert.equal(
        await page.locator("h1").count(),
        1,
        `${pageDefinition.path} should have exactly one h1`,
      );

      for (const selector of pageDefinition.requiredSelectors) {
        await assert.doesNotReject(() =>
          page.locator(selector).first().waitFor(),
        );
      }

      const previewLink = page.locator(".screenshot-link").first();
      const previewHref = await previewLink.getAttribute("href");
      assert(previewHref, "screenshot preview link should have an href");
      assert.equal(
        await previewLink.getAttribute("target"),
        null,
        "screenshot preview should not open a new tab",
      );

      await previewLink.click();

      const screenshotModal = page.locator(".screenshot-modal");
      await screenshotModal.waitFor({ state: "visible" });
      assert(
        await screenshotModal.evaluate((element) => element.open),
        "screenshot modal should be open",
      );

      const modalSource = await screenshotModal
        .locator(".screenshot-modal-image")
        .getAttribute("src");
      assert(modalSource, "screenshot modal should show an image");
      assert.equal(
        new URL(modalSource).pathname,
        new URL(previewHref, page.url()).pathname,
        "screenshot modal should show the linked full-size image",
      );
      assert(
        await page
          .locator("body")
          .evaluate((element) => element.classList.contains("modal-open")),
        "page scrolling should be locked while the modal is open",
      );

      await page.keyboard.press("Escape");
      await screenshotModal.waitFor({ state: "hidden" });
      assert(
        await previewLink.evaluate(
          (element) => element === document.activeElement,
        ),
        "focus should return to the screenshot preview link",
      );

      for (const [
        beforeSelector,
        afterSelector,
      ] of pageDefinition.minimumVerticalGaps) {
        const beforeBox = await page.locator(beforeSelector).boundingBox();
        const afterBox = await page.locator(afterSelector).boundingBox();
        assert(beforeBox, `${beforeSelector} should have a layout box`);
        assert(afterBox, `${afterSelector} should have a layout box`);
        assert(
          afterBox.y - (beforeBox.y + beforeBox.height) >= 12,
          `${beforeSelector} and ${afterSelector} should have a visible vertical gap`,
        );
      }

      assert.equal(
        errors.length,
        0,
        `browser console errors: ${errors.join("; ")}`,
      );
      await page.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("page check passed");
