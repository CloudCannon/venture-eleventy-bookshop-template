/**
 * Re-renders every page-builder block through the emitted editable-regions
 * browser bundle — the same path the CloudCannon Visual Editor takes on a data
 * change. Catches missing filters/tags, ambient-scope reads, and synthesised
 * shapes, none of which `npm run build` can see.
 *
 * Run from the project root, AFTER a build:
 *   node .agents/skills/eleventy-bookshop-migration/scripts/render-check.mjs
 *
 * Needs js-yaml resolvable from the cwd (Eleventy sites normally have it).
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const BUNDLE = process.env.ER_BUNDLE ?? "_site/register-components.js";
const PAGES = process.env.ER_PAGES ?? "src/pages";

// --- minimal DOM shim -------------------------------------------------------
class FakeEl {
  constructor(t) { this.tagName = (t || "div").toUpperCase(); this._html = ""; this.dataset = {}; this.style = {}; this.children = []; }
  set innerHTML(v) { this._html = v; } get innerHTML() { return this._html; }
  appendChild(c) { this.children.push(c); return c; }
  setAttribute() {} getAttribute() { return null; }
  addEventListener() {} removeEventListener() {}
  querySelectorAll() { return []; } querySelector() { return null; }
  get parentElement() { return null; }
}
globalThis.document = {
  createElement: (t) => new FakeEl(t), addEventListener() {}, removeEventListener() {},
  querySelectorAll: () => [], querySelector: () => null,
  body: new FakeEl("body"), head: new FakeEl("head"), documentElement: new FakeEl("html"),
  createTextNode: (t) => ({ text: t }),
};
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.customElements = { define() {}, get() { return undefined; } };
globalThis.HTMLElement = FakeEl;
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => "" });
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.location = { href: "http://localhost/", pathname: "/" };
// NB: don't touch `navigator` — it's getter-only on modern Node.

await import(path.resolve(BUNDLE));

let pass = 0, fail = 0;
for (const file of fs.readdirSync(PAGES)) {
  const raw = fs.readFileSync(path.join(PAGES, file), "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) continue;
  const fm = yaml.load(m[1]) ?? {};
  const blocks = [...(fm.hero ? [fm.hero] : []), ...(fm.content_blocks ?? [])];
  for (const [i, block] of blocks.entries()) {
    const name = block?._type;
    try {
      if (!name) throw new Error("block has no _type");
      const el = await window.cc_components[name](block);
      const html = el.innerHTML ?? "";
      if (!html.trim()) throw new Error("rendered empty");
      if (/undefined/.test(html)) throw new Error("output contains literal 'undefined'");
      pass++;
      console.log(`  ok   ${file} [${i}] ${name} (${html.length}b)`);
    } catch (e) {
      fail++;
      console.log(`  FAIL ${file} [${i}] ${name}: ${String(e.message).split("\n")[0]}`);
    }
  }
}
console.log(`\nre-render: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
