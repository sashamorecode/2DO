# Christmas completion preview

This isolated Expo Web entry imports the production `TodoCard`, `CelebrationHost`,
and Christmas artwork directly. It uses in-memory sample tasks and does not call
the app backend. It is not included in the production entry point.

After installing the frontend dependencies, from this directory:

```sh
npx expo export --platform web --output-dir /tmp/2do-christmas-preview
```

Serve the exported directory. If mounted under a subpath, rewrite the exported
HTML's `src="/_expo/` prefix to `src="./_expo/` so assets load beneath that path.

Run the native worklet regression check from the frontend directory:

```sh
node scripts/test-celebration-clock.cjs
node scripts/test-task-completion.cjs
```

With Playwright and its Chromium browser installed, verify the real components:

```sh
PREVIEW_URL=https://your-preview-url/ node scripts/test-christmas-preview.cjs
```

`PLAYWRIGHT_MODULE` may point to an existing Playwright installation. The browser
check covers continuous movement, overlay cleanup, rapid completions, reduced
motion, and alignment of the centered desktop layout. Native worklet compilation
is checked separately because Expo Web does not run the native mapper runtime.
