# Third-party notices

Agent Agency includes work from the projects below. Everything else in this
repository (code changes, all pixel art, the office layout and the theme
generators in `theme/`) is covered by this project's own [LICENSE](LICENSE).

## Pixel Agents (MIT)

Agent Agency is based on [Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents)
v1.5.0. Its source code is used under the MIT License, as are its carpet artwork
(`webview-ui/public/assets/carpets/`) and the wall silhouette the office walls are
painted over (`theme/tools/wall_template.png`).

```text
MIT License

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
SOFTWARE.
```

## FS Pixel Sans Unicode font (SIL Open Font License 1.1)

`webview-ui/public/fonts/FSPixelSansUnicode-Regular.ttf` - Copyright NZWStudios2024 2025,
built with FontStruct (<https://fontstruct.com/fontstructions/show/2606508>).
Distributed under the SIL Open Font License, Version 1.1; the license text is in
`webview-ui/public/fonts/OFL.txt` and reproduced here:

```text
FS Pixel Sans Unicode Regular
Copyright NZWStudios2024 2025. Built with FontStruct (https://fontstruct.com).
https://fontstruct.com/fontstructions/show/2606508/fs-pixel-sans-unicode-regular

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
https://openfontlicense.org


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) and the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

## Bundled npm packages

These production dependencies are bundled into `dist/` (the VS Code extension,
the standalone CLI and the web view). Each is used under its own license; full
license texts ship inside each package in `node_modules/`. Development-only
tooling (TypeScript, ESLint, Vite, Vitest, Playwright, ...) is not distributed.

| Package | Version | License |
| --- | --- | --- |
| @emnapi/core | 1.11.2 | MIT |
| @emnapi/runtime | 1.11.2 | MIT |
| @emnapi/wasi-threads | 1.2.2 | MIT |
| @fastify/accept-negotiator | 2.0.1 | MIT |
| @fastify/ajv-compiler | 4.0.5 | MIT |
| @fastify/cors | 11.3.0 | MIT |
| @fastify/error | 4.2.0 | MIT |
| @fastify/fast-json-stringify-compiler | 5.1.0 | MIT |
| @fastify/forwarded | 3.0.1 | MIT |
| @fastify/merge-json-schemas | 0.2.1 | MIT |
| @fastify/proxy-addr | 5.1.0 | MIT |
| @fastify/send | 4.1.0 | MIT |
| @fastify/static | 10.1.2 | MIT |
| @fastify/websocket | 11.3.0 | MIT |
| @lukeed/ms | 2.0.2 | MIT |
| @lydell/node-pty | 1.2.0-beta.15 | MIT |
| @lydell/node-pty-win32-x64 | 1.2.0-beta.15 | MIT |
| @material-symbols/font-700 | 0.46.0 | Apache-2.0 |
| @napi-rs/wasm-runtime | 1.1.6 | MIT |
| @pinojs/redact | 0.4.0 | MIT |
| @tybys/wasm-util | 0.10.3 | MIT |
| @xterm/addon-fit | 0.10.0 | MIT |
| @xterm/addon-web-links | 0.11.0 | MIT |
| @xterm/xterm | 5.5.0 | MIT |
| abstract-logging | 2.0.1 | MIT |
| ajv | 8.20.0 | MIT |
| ajv-formats | 3.0.1 | MIT |
| atomic-sleep | 1.0.0 | MIT |
| avvio | 9.3.0 | MIT |
| balanced-match | 4.0.4 | MIT |
| brace-expansion | 5.0.9 | MIT |
| content-disposition | 2.0.1 | MIT |
| cookie | 1.1.1 | MIT |
| depd | 2.0.0 | MIT |
| dequal | 2.0.3 | MIT |
| duplexify | 4.1.3 | MIT |
| end-of-stream | 1.4.5 | MIT |
| escape-html | 1.0.3 | MIT |
| fast-decode-uri-component | 1.0.1 | MIT |
| fast-deep-equal | 3.1.3 | MIT |
| fast-json-stringify | 7.0.1 | MIT |
| fast-querystring | 1.1.2 | MIT |
| fast-uri | 3.1.5 | BSD-3-Clause |
| fast-uri | 4.1.2 | BSD-3-Clause |
| fastify | 5.10.0 | MIT |
| fastify-plugin | 6.0.0 | MIT |
| fastq | 1.20.1 | ISC |
| find-my-way | 9.7.0 | MIT |
| glob | 13.0.6 | BlueOak-1.0.0 |
| http-errors | 2.0.1 | MIT |
| inherits | 2.0.4 | ISC |
| ipaddr.js | 2.4.0 | MIT |
| json-schema-ref-resolver | 3.0.0 | MIT |
| json-schema-traverse | 1.0.0 | MIT |
| light-my-request | 6.6.0 | BSD-3-Clause |
| lru-cache | 11.5.2 | ISC |
| mime | 3.0.0 | MIT |
| minimatch | 10.2.5 | BlueOak-1.0.0 |
| minipass | 7.1.3 | BlueOak-1.0.0 |
| on-exit-leak-free | 2.1.2 | MIT |
| once | 1.4.0 | ISC |
| path-scurry | 2.0.2 | BlueOak-1.0.0 |
| pino | 10.3.1 | MIT |
| pino-abstract-transport | 3.0.0 | MIT |
| pino-std-serializers | 7.1.0 | MIT |
| process-warning | 4.0.1 | MIT |
| process-warning | 5.0.0 | MIT |
| quick-format-unescaped | 4.0.4 | MIT |
| react | 19.2.8 | MIT |
| react-dom | 19.2.8 | MIT |
| readable-stream | 3.6.2 | MIT |
| real-require | 0.2.0 | MIT |
| real-require | 1.0.0 | MIT |
| require-from-string | 2.0.2 | MIT |
| ret | 0.5.0 | MIT |
| reusify | 1.1.0 | MIT |
| rfdc | 1.4.1 | MIT |
| safe-buffer | 5.2.1 | MIT |
| safe-regex2 | 5.1.1 | MIT |
| safe-stable-stringify | 2.5.0 | MIT |
| scheduler | 0.27.0 | MIT |
| secure-json-parse | 4.1.0 | BSD-3-Clause |
| semver | 7.8.5 | ISC |
| set-cookie-parser | 2.7.2 | MIT |
| setprototypeof | 1.2.0 | ISC |
| sonic-boom | 4.2.1 | MIT |
| split2 | 4.2.0 | ISC |
| statuses | 2.0.2 | MIT |
| stream-shift | 1.0.3 | MIT |
| string_decoder | 1.3.0 | MIT |
| thread-stream | 4.2.0 | MIT |
| toad-cache | 3.7.4 | MIT |
| toidentifier | 1.0.1 | MIT |
| tslib | 2.8.1 | 0BSD |
| util-deprecate | 1.0.2 | MIT |
| wrappy | 1.0.2 | ISC |
| ws | 8.21.1 | MIT |

_Generated by `node scripts/gen-third-party-notices.mjs`._
