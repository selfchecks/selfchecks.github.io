function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function protectSegments(input, pattern, className) {
  const segments = [];
  let output = "";
  let lastIndex = 0;
  const regex = new RegExp(pattern.source, pattern.flags);
  let match;

  while ((match = regex.exec(input)) !== null) {
    const [text] = match;
    const token = `__TOKEN_${segments.length}__`;
    output += input.slice(lastIndex, match.index);
    output += token;
    segments.push(`<span class="${className}">${text}</span>`);
    lastIndex = match.index + text.length;

    if (text.length === 0) {
      regex.lastIndex += 1;
    }
  }

  output += input.slice(lastIndex);

  return { output, segments };
}

function restoreSegments(input, segments) {
  return segments.reduce(
    (html, segment, index) => html.replace(`__TOKEN_${index}__`, segment),
    input,
  );
}

function highlightShellLine(line) {
  if (/^\s*#/.test(line)) {
    return `<span class="token-comment">${escapeHtml(line)}</span>`;
  }

  let html = escapeHtml(line);
  const segmentGroups = [];

  for (const entry of [
    { pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, className: "token-string" },
    { pattern: /\$\{[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*/g, className: "token-variable" },
  ]) {
    const result = protectSegments(html, entry.pattern, entry.className);
    html = result.output;
    segmentGroups.push(result.segments);
  }

  html = html
    .replace(/(^|\s)(selfchecks|deploy|test|trigger)(?=\s|$)/g, '$1<span class="token-keyword">$2</span>')
    .replace(/(^|\s)(--[A-Za-z0-9-]+)/g, '$1<span class="token-flag">$2</span>')
    .replace(/(^|\s)(-[A-Za-z])(?=\s|$)/g, '$1<span class="token-flag">$2</span>');

  for (let index = segmentGroups.length - 1; index >= 0; index -= 1) {
    html = restoreSegments(html, segmentGroups[index]);
  }

  return html;
}

function highlightTypeScriptLine(line) {
  let html = escapeHtml(line);
  const segmentGroups = [];

  for (const entry of [
    { pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, className: "token-string" },
    { pattern: /\b\d+(?:\.\d+)?\b/g, className: "token-number" },
  ]) {
    const result = protectSegments(html, entry.pattern, entry.className);
    html = result.output;
    segmentGroups.push(result.segments);
  }

  html = html
    .replace(/\b(new|true|false)\b/g, '<span class="token-keyword">$1</span>')
    .replace(/\b(BrowserCheck|Frequency)\b/g, '<span class="token-function">$1</span>')
    .replace(/^(\s*)([A-Za-z0-9_]+)(:)/, '$1<span class="token-key">$2</span><span class="token-punctuation">$3</span>');

  for (let index = segmentGroups.length - 1; index >= 0; index -= 1) {
    html = restoreSegments(html, segmentGroups[index]);
  }

  return html;
}

function highlightCodeBlock(block) {
  const lang = block.getAttribute("data-lang");
  const highlighter = lang === "ts" ? highlightTypeScriptLine : highlightShellLine;
  const raw = block.textContent ?? "";
  block.innerHTML = raw.split("\n").map((line) => highlighter(line)).join("\n");
}

function setupCopyButtons() {
  for (const button of document.querySelectorAll("[data-copy-target]")) {
    button.addEventListener("click", async () => {
      const targetId = button.getAttribute("data-copy-target");
      const target = targetId ? document.getElementById(targetId) : null;

      if (!target) {
        return;
      }

      const original = button.textContent;

      try {
        await navigator.clipboard.writeText((target.textContent ?? "").trim());
        button.textContent = "Copied";
      } catch {
        button.textContent = "Copy failed";
      }

      window.setTimeout(() => {
        button.textContent = original;
      }, 1500);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  for (const block of document.querySelectorAll("pre code[data-lang]")) {
    highlightCodeBlock(block);
  }

  setupCopyButtons();
});
