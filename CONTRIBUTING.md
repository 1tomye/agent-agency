# Contributing

1. `npm ci`
2. Make your change. Office behaviour lives in `webview-ui/src/office/` (`boss.ts`, `breakTime.ts`);
   art and the layout are generated from `theme/tools/` (see the README).
3. Check it: `npm run check-types`, `npm run lint`, `npm run format:check`, `npm run test:webview`.
   CI also runs `npm run test:server` and a full build.
4. If you change dependencies, run `npm run notices` to refresh `THIRD_PARTY_NOTICES.md`.

The repository's ESLint rules keep the pixel look consistent: colours live in
`webview-ui/src/constants.ts` or `webview-ui/src/office/sprites/`, shadows are hard-edged, and the
UI font is FS Pixel Sans. `CLAUDE.md` describes the architecture in depth.
