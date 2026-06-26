# Selfchecks Landing

This repository contains the static marketing site for Selfchecks.

Website:

- https://selfchecks.github.io/

## What is here

- `index.html` - landing page markup
- `styles.css` - visual styles
- `app.js` - small client-side interactions
- `assets/` - generated product mockups and social images
- `robots.txt`, `sitemap.xml`, `llms.txt` - crawl and discovery files

## Local preview

From the repository root:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173
```

## Checks

```bash
npm run check
```

Regenerate visual assets:

```bash
npm run render:assets
```

## Publishing

GitHub Pages serves this repository directly.

Any push to `main` updates:

```text
https://selfchecks.github.io/
```

## Main project

The application source code lives in:

- https://github.com/selfchecks/selfchecks
