#!/usr/bin/env node
/**
 * Regenerate THIRD_PARTY_NOTICES.md: the upstream project, the bundled font,
 * and every production npm package that ends up in dist/ (esbuild bundles the
 * server and webview dependencies into the extension and the CLI).
 *
 * Usage: node scripts/gen-third-party-notices.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACES = new Set(['pixel-agents', 'webview-ui', 'agent-agency']);

/** name@version -> { name, version, license } for every production dependency. */
function productionPackages() {
  // A fixed command string (no user input), run through the shell so npm.cmd resolves on Windows.
  const out = execSync('npm ls --omit=dev --all --json', {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const tree = JSON.parse(out);
  const found = new Map();
  const walk = (deps) => {
    for (const [name, info] of Object.entries(deps ?? {})) {
      if (!info || !info.version) continue;
      if (!WORKSPACES.has(name)) {
        const key = `${name}@${info.version}`;
        if (!found.has(key))
          found.set(key, { name, version: info.version, license: licenseOf(name, info) });
      }
      walk(info.dependencies);
    }
  };
  walk(tree.dependencies);
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function licenseOf(name, info) {
  const candidates = [info.path, path.join(root, 'node_modules', name)].filter(Boolean);
  for (const dir of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      const lic = pkg.license ?? pkg.licenses;
      if (typeof lic === 'string') return lic;
      if (Array.isArray(lic)) return lic.map((l) => l.type ?? l).join(' OR ');
      if (lic?.type) return lic.type;
    } catch {
      // try the next location
    }
  }
  return 'UNKNOWN';
}

const pixelAgentsLicense = `MIT License

Copyright (c) 2026 Pablo De Lucca

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const oflText = fs
  .readFileSync(path.join(root, 'webview-ui', 'public', 'fonts', 'OFL.txt'), 'utf8')
  .trim();

const packages = productionPackages();
const unknown = packages.filter((p) => p.license === 'UNKNOWN');
const rows = packages.map((p) => `| ${p.name} | ${p.version} | ${p.license} |`).join('\n');

const doc = `# Third-party notices

Agent Agency includes work from the projects below. Everything else in this
repository (code changes, all pixel art, the office layout and the theme
generators in \`theme/\`) is covered by this project's own [LICENSE](LICENSE).

## Pixel Agents (MIT)

Agent Agency is based on [Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents)
v1.5.0. Its source code is used under the MIT License, as are its carpet artwork
(\`webview-ui/public/assets/carpets/\`) and the wall silhouette the office walls are
painted over (\`theme/tools/wall_template.png\`).

\`\`\`text
${pixelAgentsLicense}
\`\`\`

## FS Pixel Sans Unicode font (SIL Open Font License 1.1)

\`webview-ui/public/fonts/FSPixelSansUnicode-Regular.ttf\` - Copyright NZWStudios2024 2025,
built with FontStruct (<https://fontstruct.com/fontstructions/show/2606508>).
Distributed under the SIL Open Font License, Version 1.1; the license text is in
\`webview-ui/public/fonts/OFL.txt\` and reproduced here:

\`\`\`text
${oflText}
\`\`\`

## Bundled npm packages

These production dependencies are bundled into \`dist/\` (the VS Code extension,
the standalone CLI and the web view). Each is used under its own license; full
license texts ship inside each package in \`node_modules/\`. Development-only
tooling (TypeScript, ESLint, Vite, Vitest, Playwright, ...) is not distributed.

| Package | Version | License |
| --- | --- | --- |
${rows}
${unknown.length ? `\n> License not declared in package metadata: ${unknown.map((p) => p.name).join(', ')}. Check before publishing.\n` : ''}
_Generated by \`node scripts/gen-third-party-notices.mjs\`._
`;

fs.writeFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), doc);
console.log(
  `THIRD_PARTY_NOTICES.md: ${packages.length} packages${unknown.length ? `, ${unknown.length} without a declared license` : ''}`,
);
