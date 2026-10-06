# Test results — Stage 1.1 with fixes 1.1.1

Executed on 6 October 2026 in a Linux container with Node.js 22.22.2, Playwright 1.56 and Chromium 141.0.7390.37 (headless).

## What changed in 1.1.1

1. **Tests no longer depend on the repository holding placeholders.** `tests/template.mjs` copies `site/` and `tools/` into a temporary folder, without `site.config.json`. It then runs `config.mjs apply` there with no settings, which resets every marked field to its placeholder and regenerates `sitemap.xml` and `robots.txt`. It checks the result is a clean template. `config-tests.mjs` and `run-all.mjs` both start from this template. The owner's `site/` and `site.config.json` are fingerprinted before testing and checked after.
2. **Markers are validated page by page.** About needs exactly 1 owner-name. Contact needs 1 owner-name, 1 email and 1 email-link. Privacy needs 1 email and 1 email-link. Every other page needs none. Malformed markers (the attribute present but not in the expected form) are also reported. `status` and `prepublish` fail and name the page. `set` and `apply` refuse before writing anything.

## Both findings reproduced before the fixes

Run on a copy of the Stage 1.1 code:
- **Finding 1:** after `node tools/config.mjs set --domain myphoto.example.com --name Sem --email sem@example.com`, `node tests/config-tests.mjs` gave **11 passed, 2 failed**. The two failures were "Template copy: status consistent but incomplete, prepublish fails" and "Invalid inputs leave all files unchanged".
- **Finding 2:** after replacing `<span data-config="owner-name">Sem</span>` with `<span>Old Owner</span>` in `site/contact/index.html`, `prepublish` printed "Ready to publish" and exited 0.

After the fix, the same steps for finding 2 give `prepublish` exit 1, `status` exit 1, and `set --name Sem2` refused. The message is `contact/index.html: expected 1 "owner-name" marker, found 0 (missing)`. The file still contains "Old Owner" and `site.config.json` still says "Sem".

## State A: fresh ZIP extract (unconfigured)

Commands, from the extracted `devmmx-phototools/` folder:
```
node tests/generate-fixtures.mjs
node tools/config.mjs status      # "Consistent, but setup incomplete: domain, name, email not set."
node tests/run-all.mjs            # exit 0
```
Summary: configuration 29/29, template copy 40/40, configured copy 40/40. The owner's `site/` and `site.config.json` were unchanged by testing.

## State B: same working repository, configured with real-looking values

Commands, run in the same folder after state A:
```
node tools/config.mjs set --domain myphoto.example.com --name Sem --email sem@example.com
node tools/config.mjs prepublish  # "Ready to publish", exit 0
node tests/config-tests.mjs       # exit 0, 29 passed (the exact command from finding 1)
node tests/run-all.mjs            # exit 0
```
Summary: standalone configuration 29/29, then run-all with configuration 29/29, template copy 40/40 and configured copy 40/40. The template copy used the placeholders, not "Sem". The configured copy used the test settings `phototools-test.example.com` / "Test Owner & Co". A SHA-256 fingerprint of the owner's `site/` files plus `site.config.json` was identical before and after (`0bbed76d1f94a383…`). Afterwards `site.config.json` still held myphoto.example.com / Sem / sem@example.com, and `prepublish` still passed.

## New configuration regressions (16, all in both states)

- The exact finding-2 reproduction (Contact owner marker replaced by plain text).
- Removing each of the 6 required markers on its own: about/owner-name, contact/owner-name, contact/email, contact/email-link, privacy/email, privacy/email-link.
- Duplicating each of those 6 markers.
- A malformed marker (extra attribute) and a marker on an unexpected page.
- Template built from a repository configured with real-looking values: correct placeholders, none of the owner's values, and that repository unchanged.
- The owner's working files unchanged after the whole configuration suite.

For each structural case the test checks:
- `status` and `prepublish` exit 1 and name the page and marker;
- `apply` and `set` exit 1 with "Nothing was changed";
- all files, including `site.config.json`, are byte-identical afterwards.

## Reports, state A (verbatim)

### Configuration
```
devMmX PhotoTools configuration tests
Run at: 2026-10-06T11:06:37.723Z
Node.js v22.22.2

PASS  Template copy: status consistent but incomplete, prepublish fails
PASS  All fields supplied together
PASS  Domain first, then name and email (no corrupted email)
PASS  Name and email first, then domain
PASS  Changing all three fields replaces every old value
PASS  Changing one field at a time after full setup
PASS  pages.dev hostname, then a custom domain
PASS  Running unchanged settings twice changes nothing
PASS  Reapplying saved settings after unpacking an updated ZIP
PASS  Invalid inputs leave all files unchanged
PASS  Values are escaped and inserted literally ($&, quotes, angle brackets)
PASS  Hand-edited or missing fields are detected
PASS  Broken site.config.json is reported and nothing changes
PASS  Exact reproduction: owner marker on Contact replaced by plain text is caught
PASS  Removing owner-name marker on about/index.html fails status, prepublish, set and apply
PASS  Duplicating owner-name marker on about/index.html fails status, prepublish, set and apply
PASS  Removing owner-name marker on contact/index.html fails status, prepublish, set and apply
PASS  Duplicating owner-name marker on contact/index.html fails status, prepublish, set and apply
PASS  Removing email marker on contact/index.html fails status, prepublish, set and apply
PASS  Duplicating email marker on contact/index.html fails status, prepublish, set and apply
PASS  Removing email-link marker on contact/index.html fails status, prepublish, set and apply
PASS  Duplicating email-link marker on contact/index.html fails status, prepublish, set and apply
PASS  Removing email marker on privacy/index.html fails status, prepublish, set and apply
PASS  Duplicating email marker on privacy/index.html fails status, prepublish, set and apply
PASS  Removing email-link marker on privacy/index.html fails status, prepublish, set and apply
PASS  Duplicating email-link marker on privacy/index.html fails status, prepublish, set and apply
PASS  Malformed marker (extra attribute) and marker on an unexpected page are caught
PASS  Template is built correctly from a repository configured with real-looking values, which stays unchanged
PASS  Owner's working site/ and site.config.json are unchanged after all configuration tests

29 passed, 0 failed, 29 total
```

### Browser, template copy
```
devMmX PhotoTools browser test report (template copy)
Site folder: /tmp/phototools-copies-TlW3YB/template/site
Run at: 2026-10-06T11:07:29.300Z
Browser: Chromium 141.0.7390.37 (Playwright, headless, Linux)

PASS  Success: 3000x2000 JPEG to 100 KB, quality only, dimensions unchanged  (1534 ms)
PASS  Success: 1600x1200 WebP to 50 KB  (786 ms)
PASS  Success: custom 75 KB limit  (1291 ms)
PASS  Success: PNG with .jpg extension is detected by content  (600 ms)
PASS  Success with resize: noisy 2000x1500 PNG to 20 KB, smaller dims, same aspect ratio  (1076 ms)
PASS  Transparency: notice shown and transparent area becomes white  (752 ms)
PASS  Metadata: EXIF block in input is not present in output  (1214 ms)
PASS  Impossible target: 20 KB on noisy PNG without resize gives error, no download  (874 ms)
PASS  Already-small JPEG: note says it is already under the limit  (235 ms)
PASS  Rejects random-bytes.jpg with a clear error  (352 ms)
PASS  Rejects jpeg-garbage.jpg with a clear error  (265 ms)
PASS  Rejects truncated.jpg with a clear error  (269 ms)
PASS  Rejects text-renamed.png with a clear error  (292 ms)
PASS  Rejects huge-dimensions.png with a clear error  (234 ms)
PASS  Rejects bad-data.png with a clear error  (254 ms)
PASS  Rejects animation.gif with a clear error  (237 ms)
PASS  Rejects photo.heic with a clear error  (257 ms)
PASS  Rejects empty.jpg with a clear error  (228 ms)
PASS  Rejects oversized.jpg with a clear error  (224 ms)
PASS  Custom limit validation  (526 ms)
PASS  Reset clears image, result, download link and releases object URLs  (818 ms)
PASS  Replacing the image during processing cancels the old run (no stale result or download)  (4751 ms)
PASS  Choosing a new image after success removes the old download  (799 ms)
PASS  No image data is transmitted (request log, server log, CSP blocks connections)  (1372 ms)
PASS  Options are locked while compressing; picker and Start over stay usable  (1297 ms)
PASS  Preset change during a slowed encode cancels the run; new run uses the new limit  (4040 ms)
PASS  Custom-limit edit during a slowed encode cancels the run; new run uses the new limit  (3908 ms)
PASS  Resize-option change during a slowed encode cancels the run  (3684 ms)
PASS  Option changed without an event: finished result is discarded, not published  (982 ms)
PASS  Start over during processing cancels cleanly  (3791 ms)
PASS  Leaving mid-run (pagehide) and returning from back/forward cache (pageshow) gives a clean, usable tool  (4229 ms)
PASS  Wide 12000x60 noisy PNG to 40 KB with resizing: succeeds within limits (finding 4)  (777 ms)
PASS  Wide 12000x60 noisy PNG to 5 KB: honest "smallest allowed size" message with measured size  (626 ms)
PASS  Screenshots: mobile compressor before and after a successful result  (1843 ms)
PASS  Pages: status, unique titles/descriptions, one h1, canonical, internal links resolve  (903 ms)
PASS  404: unknown path returns 404 page with noindex and working links  (141 ms)
PASS  Layout at 360px: no horizontal scroll on any page, touch targets >= 44px  (2192 ms)
PASS  Layout at 1280px: no horizontal scroll on any page  (2684 ms)
PASS  Keyboard: skip link first, file picker reachable by Tab with visible focus  (257 ms)
PASS  Without JavaScript: instructions readable, tool hidden, notice shown  (151 ms)

40 passed, 0 failed, 40 total

Details:
  jpg100: photo.jpg -> 93398 bytes (limit 102400), 3000x2000
  webp50: photo.webp -> 47483 bytes (limit 51200), 1600x1200
  custom75: photo.jpg -> 74696 bytes (limit 76800), 3000x2000
  pngnamedjpg: png-named-as.jpg -> 20144 bytes (limit 20480), 800x600
  noise20resize: noisy.png -> 19450 bytes (limit 20480), 362x272
  transparent: 50739 bytes; sampled pixels [[255,255,255,255],[255,255,255,255]]
  impossible: Could not get this image under 20 KB (20,480 bytes). No file was created.The smallest result was 248.3 KB (254,295 bytes) at 10% quality and the original 2,000 × 1,500 px.Lowering the quality alone wa [encodes: 2]
  bad:random-bytes.jpg: Unsupported file: random-bytes.jpg.This file is not a JPEG, PNG or WebP image. Renaming a file (for example .pdf to .jpg) does not change its format.
  bad:jpeg-garbage.jpg: jpeg-garbage.jpg could not be read as an image.The file looks damaged, or it is not really the format its name suggests. Try the original photo again.
  bad:truncated.jpg: truncated.jpg could not be read as an image.The JPEG file is incomplete. It may have been cut off while downloading or copying. Try the original photo again.
  bad:text-renamed.png: Unsupported file: text-renamed.png.This file is not a JPEG, PNG or WebP image. Renaming a file (for example .pdf to .jpg) does not change its format.
  bad:huge-dimensions.png: Image too large: huge-dimensions.png.This image is 20,000 × 20,000 px (400.0 megapixels). The limit is 40 megapixels and 12,000 px on the longest side, to avoid
  bad:bad-data.png: bad-data.png could not be opened. The file may be damaged, or your browser cannot decode it.
  bad:animation.gif: Unsupported file: animation.gif.This is a GIF file. This tool accepts JPEG, PNG and WebP only.
  bad:photo.heic: Unsupported file: photo.heic.This is a HEIC/HEIF photo. Convert it to JPEG first (some phone camera or gallery apps have a JPEG or "most compatible" option), th
  bad:empty.jpg: empty.jpg is empty (0 bytes). Choose another file.
  bad:oversized.jpg: oversized.jpg is 26,624.0 KB (27,262,976 bytes). The largest file this tool accepts is 25,600.0 KB (25 MB).
  replace: status after replace began with: "Image ready. Choose a size limit, then press Compress."; final download photo-under-50kb.jpg 47483 bytes
  network: page requests: GET /compress-image-to-kb/, GET /assets/css/style.css, GET /assets/img/favicon.svg, GET /assets/js/compressor.js, GET blob:/8624dd93-a884-47eb-8b9a-ce83f68506d2, GET blob:/12357657-5b4b-42fa-b97e-6dda9b038589; requests during processing: 0 network (2 local blob: preview loads); server saw 4 GETs with empty bodies; fetch() blocked by CSP
  presetChange: 200 KB run cancelled by switch to 50 KB; new download 47483 bytes
  customChange: 150 KB run cancelled by edit to 60 KB; new download 57907 bytes
  wide40: wide-noise.png -> 40905 bytes (limit 40960), 6400x32
  wide5: Could not get this image under 5 KB (5,120 bytes). No file was created.Even at the smallest size this tool allows, 6,400 × 32 px (shortest side 32 px), and 10% quality, the file was 7.10 KB (7,266 bytes). Choose a larger limit. [independent Chromium measurement: 7266 bytes; encodes 6]
  pages: 7 pages, 7 unique internal links checked; origin https://YOUR-DOMAIN.example; owner "OWNER-NAME-PLACEHOLDER"; email CONTACT-EMAIL-PLACEHOLDER
```

### Browser, configured copy
```
devMmX PhotoTools browser test report (configured copy)
Site folder: /tmp/phototools-copies-TlW3YB/configured/site
Run at: 2026-10-06T11:08:20.668Z
Browser: Chromium 141.0.7390.37 (Playwright, headless, Linux)

PASS  Success: 3000x2000 JPEG to 100 KB, quality only, dimensions unchanged  (1529 ms)
PASS  Success: 1600x1200 WebP to 50 KB  (1013 ms)
PASS  Success: custom 75 KB limit  (1418 ms)
PASS  Success: PNG with .jpg extension is detected by content  (690 ms)
PASS  Success with resize: noisy 2000x1500 PNG to 20 KB, smaller dims, same aspect ratio  (1227 ms)
PASS  Transparency: notice shown and transparent area becomes white  (832 ms)
PASS  Metadata: EXIF block in input is not present in output  (1296 ms)
PASS  Impossible target: 20 KB on noisy PNG without resize gives error, no download  (815 ms)
PASS  Already-small JPEG: note says it is already under the limit  (256 ms)
PASS  Rejects random-bytes.jpg with a clear error  (249 ms)
PASS  Rejects jpeg-garbage.jpg with a clear error  (246 ms)
PASS  Rejects truncated.jpg with a clear error  (251 ms)
PASS  Rejects text-renamed.png with a clear error  (288 ms)
PASS  Rejects huge-dimensions.png with a clear error  (242 ms)
PASS  Rejects bad-data.png with a clear error  (227 ms)
PASS  Rejects animation.gif with a clear error  (213 ms)
PASS  Rejects photo.heic with a clear error  (220 ms)
PASS  Rejects empty.jpg with a clear error  (228 ms)
PASS  Rejects oversized.jpg with a clear error  (223 ms)
PASS  Custom limit validation  (555 ms)
PASS  Reset clears image, result, download link and releases object URLs  (810 ms)
PASS  Replacing the image during processing cancels the old run (no stale result or download)  (4669 ms)
PASS  Choosing a new image after success removes the old download  (703 ms)
PASS  No image data is transmitted (request log, server log, CSP blocks connections)  (1157 ms)
PASS  Options are locked while compressing; picker and Start over stay usable  (1292 ms)
PASS  Preset change during a slowed encode cancels the run; new run uses the new limit  (3818 ms)
PASS  Custom-limit edit during a slowed encode cancels the run; new run uses the new limit  (3851 ms)
PASS  Resize-option change during a slowed encode cancels the run  (3560 ms)
PASS  Option changed without an event: finished result is discarded, not published  (1020 ms)
PASS  Start over during processing cancels cleanly  (3892 ms)
PASS  Leaving mid-run (pagehide) and returning from back/forward cache (pageshow) gives a clean, usable tool  (4310 ms)
PASS  Wide 12000x60 noisy PNG to 40 KB with resizing: succeeds within limits (finding 4)  (868 ms)
PASS  Wide 12000x60 noisy PNG to 5 KB: honest "smallest allowed size" message with measured size  (615 ms)
PASS  Screenshots: mobile compressor before and after a successful result  (1925 ms)
PASS  Pages: status, unique titles/descriptions, one h1, canonical, internal links resolve  (754 ms)
PASS  404: unknown path returns 404 page with noindex and working links  (137 ms)
PASS  Layout at 360px: no horizontal scroll on any page, touch targets >= 44px  (2113 ms)
PASS  Layout at 1280px: no horizontal scroll on any page  (2470 ms)
PASS  Keyboard: skip link first, file picker reachable by Tab with visible focus  (263 ms)
PASS  Without JavaScript: instructions readable, tool hidden, notice shown  (165 ms)

40 passed, 0 failed, 40 total

Details:
  jpg100: photo.jpg -> 93398 bytes (limit 102400), 3000x2000
  webp50: photo.webp -> 47483 bytes (limit 51200), 1600x1200
  custom75: photo.jpg -> 74696 bytes (limit 76800), 3000x2000
  pngnamedjpg: png-named-as.jpg -> 20144 bytes (limit 20480), 800x600
  noise20resize: noisy.png -> 19450 bytes (limit 20480), 362x272
  transparent: 50739 bytes; sampled pixels [[255,255,255,255],[255,255,255,255]]
  impossible: Could not get this image under 20 KB (20,480 bytes). No file was created.The smallest result was 248.3 KB (254,295 bytes) at 10% quality and the original 2,000 × 1,500 px.Lowering the quality alone wa [encodes: 2]
  bad:random-bytes.jpg: Unsupported file: random-bytes.jpg.This file is not a JPEG, PNG or WebP image. Renaming a file (for example .pdf to .jpg) does not change its format.
  bad:jpeg-garbage.jpg: jpeg-garbage.jpg could not be read as an image.The file looks damaged, or it is not really the format its name suggests. Try the original photo again.
  bad:truncated.jpg: truncated.jpg could not be read as an image.The JPEG file is incomplete. It may have been cut off while downloading or copying. Try the original photo again.
  bad:text-renamed.png: Unsupported file: text-renamed.png.This file is not a JPEG, PNG or WebP image. Renaming a file (for example .pdf to .jpg) does not change its format.
  bad:huge-dimensions.png: Image too large: huge-dimensions.png.This image is 20,000 × 20,000 px (400.0 megapixels). The limit is 40 megapixels and 12,000 px on the longest side, to avoid
  bad:bad-data.png: bad-data.png could not be opened. The file may be damaged, or your browser cannot decode it.
  bad:animation.gif: Unsupported file: animation.gif.This is a GIF file. This tool accepts JPEG, PNG and WebP only.
  bad:photo.heic: Unsupported file: photo.heic.This is a HEIC/HEIF photo. Convert it to JPEG first (some phone camera or gallery apps have a JPEG or "most compatible" option), th
  bad:empty.jpg: empty.jpg is empty (0 bytes). Choose another file.
  bad:oversized.jpg: oversized.jpg is 26,624.0 KB (27,262,976 bytes). The largest file this tool accepts is 25,600.0 KB (25 MB).
  replace: status after replace began with: "Image ready. Choose a size limit, then press Compress."; final download photo-under-50kb.jpg 47483 bytes
  network: page requests: GET /compress-image-to-kb/, GET /assets/css/style.css, GET /assets/img/favicon.svg, GET /assets/js/compressor.js, GET blob:/6d976bf6-8c0d-4231-9660-4f298cf3927b, GET blob:/9338dc1f-1cc8-46cb-85f8-2fcc300b5d16; requests during processing: 0 network (2 local blob: preview loads); server saw 4 GETs with empty bodies; fetch() blocked by CSP
  presetChange: 200 KB run cancelled by switch to 50 KB; new download 47483 bytes
  customChange: 150 KB run cancelled by edit to 60 KB; new download 57907 bytes
  wide40: wide-noise.png -> 40905 bytes (limit 40960), 6400x32
  wide5: Could not get this image under 5 KB (5,120 bytes). No file was created.Even at the smallest size this tool allows, 6,400 × 32 px (shortest side 32 px), and 10% quality, the file was 7.10 KB (7,266 bytes). Choose a larger limit. [independent Chromium measurement: 7266 bytes; encodes 6]
  pages: 7 pages, 7 unique internal links checked; origin https://phototools-test.example.com; owner "Test Owner & Co"; email owner@phototools-test.example.com
```

## Reports, state B (verbatim, from run-all)

### Configuration
```
devMmX PhotoTools configuration tests
Run at: 2026-10-06T11:08:54.533Z
Node.js v22.22.2

PASS  Template copy: status consistent but incomplete, prepublish fails
PASS  All fields supplied together
PASS  Domain first, then name and email (no corrupted email)
PASS  Name and email first, then domain
PASS  Changing all three fields replaces every old value
PASS  Changing one field at a time after full setup
PASS  pages.dev hostname, then a custom domain
PASS  Running unchanged settings twice changes nothing
PASS  Reapplying saved settings after unpacking an updated ZIP
PASS  Invalid inputs leave all files unchanged
PASS  Values are escaped and inserted literally ($&, quotes, angle brackets)
PASS  Hand-edited or missing fields are detected
PASS  Broken site.config.json is reported and nothing changes
PASS  Exact reproduction: owner marker on Contact replaced by plain text is caught
PASS  Removing owner-name marker on about/index.html fails status, prepublish, set and apply
PASS  Duplicating owner-name marker on about/index.html fails status, prepublish, set and apply
PASS  Removing owner-name marker on contact/index.html fails status, prepublish, set and apply
PASS  Duplicating owner-name marker on contact/index.html fails status, prepublish, set and apply
PASS  Removing email marker on contact/index.html fails status, prepublish, set and apply
PASS  Duplicating email marker on contact/index.html fails status, prepublish, set and apply
PASS  Removing email-link marker on contact/index.html fails status, prepublish, set and apply
PASS  Duplicating email-link marker on contact/index.html fails status, prepublish, set and apply
PASS  Removing email marker on privacy/index.html fails status, prepublish, set and apply
PASS  Duplicating email marker on privacy/index.html fails status, prepublish, set and apply
PASS  Removing email-link marker on privacy/index.html fails status, prepublish, set and apply
PASS  Duplicating email-link marker on privacy/index.html fails status, prepublish, set and apply
PASS  Malformed marker (extra attribute) and marker on an unexpected page are caught
PASS  Template is built correctly from a repository configured with real-looking values, which stays unchanged
PASS  Owner's working site/ and site.config.json are unchanged after all configuration tests

29 passed, 0 failed, 29 total
```

### Browser, template copy
```
devMmX PhotoTools browser test report (template copy)
Site folder: /tmp/phototools-copies-Nqrvtt/template/site
Run at: 2026-10-06T11:09:45.004Z
Browser: Chromium 141.0.7390.37 (Playwright, headless, Linux)

PASS  Success: 3000x2000 JPEG to 100 KB, quality only, dimensions unchanged  (1480 ms)
PASS  Success: 1600x1200 WebP to 50 KB  (824 ms)
PASS  Success: custom 75 KB limit  (2027 ms)
PASS  Success: PNG with .jpg extension is detected by content  (615 ms)
PASS  Success with resize: noisy 2000x1500 PNG to 20 KB, smaller dims, same aspect ratio  (1110 ms)
PASS  Transparency: notice shown and transparent area becomes white  (808 ms)
PASS  Metadata: EXIF block in input is not present in output  (1380 ms)
PASS  Impossible target: 20 KB on noisy PNG without resize gives error, no download  (830 ms)
PASS  Already-small JPEG: note says it is already under the limit  (236 ms)
PASS  Rejects random-bytes.jpg with a clear error  (212 ms)
PASS  Rejects jpeg-garbage.jpg with a clear error  (212 ms)
PASS  Rejects truncated.jpg with a clear error  (244 ms)
PASS  Rejects text-renamed.png with a clear error  (223 ms)
PASS  Rejects huge-dimensions.png with a clear error  (257 ms)
PASS  Rejects bad-data.png with a clear error  (252 ms)
PASS  Rejects animation.gif with a clear error  (245 ms)
PASS  Rejects photo.heic with a clear error  (233 ms)
PASS  Rejects empty.jpg with a clear error  (233 ms)
PASS  Rejects oversized.jpg with a clear error  (204 ms)
PASS  Custom limit validation  (500 ms)
PASS  Reset clears image, result, download link and releases object URLs  (695 ms)
PASS  Replacing the image during processing cancels the old run (no stale result or download)  (4596 ms)
PASS  Choosing a new image after success removes the old download  (792 ms)
PASS  No image data is transmitted (request log, server log, CSP blocks connections)  (1215 ms)
PASS  Options are locked while compressing; picker and Start over stay usable  (1214 ms)
PASS  Preset change during a slowed encode cancels the run; new run uses the new limit  (3873 ms)
PASS  Custom-limit edit during a slowed encode cancels the run; new run uses the new limit  (3841 ms)
PASS  Resize-option change during a slowed encode cancels the run  (3556 ms)
PASS  Option changed without an event: finished result is discarded, not published  (945 ms)
PASS  Start over during processing cancels cleanly  (3609 ms)
PASS  Leaving mid-run (pagehide) and returning from back/forward cache (pageshow) gives a clean, usable tool  (4110 ms)
PASS  Wide 12000x60 noisy PNG to 40 KB with resizing: succeeds within limits (finding 4)  (794 ms)
PASS  Wide 12000x60 noisy PNG to 5 KB: honest "smallest allowed size" message with measured size  (594 ms)
PASS  Screenshots: mobile compressor before and after a successful result  (1721 ms)
PASS  Pages: status, unique titles/descriptions, one h1, canonical, internal links resolve  (840 ms)
PASS  404: unknown path returns 404 page with noindex and working links  (149 ms)
PASS  Layout at 360px: no horizontal scroll on any page, touch targets >= 44px  (2178 ms)
PASS  Layout at 1280px: no horizontal scroll on any page  (2521 ms)
PASS  Keyboard: skip link first, file picker reachable by Tab with visible focus  (231 ms)
PASS  Without JavaScript: instructions readable, tool hidden, notice shown  (126 ms)

40 passed, 0 failed, 40 total

Details:
  jpg100: photo.jpg -> 93398 bytes (limit 102400), 3000x2000
  webp50: photo.webp -> 47483 bytes (limit 51200), 1600x1200
  custom75: photo.jpg -> 74696 bytes (limit 76800), 3000x2000
  pngnamedjpg: png-named-as.jpg -> 20144 bytes (limit 20480), 800x600
  noise20resize: noisy.png -> 19450 bytes (limit 20480), 362x272
  transparent: 50739 bytes; sampled pixels [[255,255,255,255],[255,255,255,255]]
  impossible: Could not get this image under 20 KB (20,480 bytes). No file was created.The smallest result was 248.3 KB (254,295 bytes) at 10% quality and the original 2,000 × 1,500 px.Lowering the quality alone wa [encodes: 2]
  bad:random-bytes.jpg: Unsupported file: random-bytes.jpg.This file is not a JPEG, PNG or WebP image. Renaming a file (for example .pdf to .jpg) does not change its format.
  bad:jpeg-garbage.jpg: jpeg-garbage.jpg could not be read as an image.The file looks damaged, or it is not really the format its name suggests. Try the original photo again.
  bad:truncated.jpg: truncated.jpg could not be read as an image.The JPEG file is incomplete. It may have been cut off while downloading or copying. Try the original photo again.
  bad:text-renamed.png: Unsupported file: text-renamed.png.This file is not a JPEG, PNG or WebP image. Renaming a file (for example .pdf to .jpg) does not change its format.
  bad:huge-dimensions.png: Image too large: huge-dimensions.png.This image is 20,000 × 20,000 px (400.0 megapixels). The limit is 40 megapixels and 12,000 px on the longest side, to avoid
  bad:bad-data.png: bad-data.png could not be opened. The file may be damaged, or your browser cannot decode it.
  bad:animation.gif: Unsupported file: animation.gif.This is a GIF file. This tool accepts JPEG, PNG and WebP only.
  bad:photo.heic: Unsupported file: photo.heic.This is a HEIC/HEIF photo. Convert it to JPEG first (some phone camera or gallery apps have a JPEG or "most compatible" option), th
  bad:empty.jpg: empty.jpg is empty (0 bytes). Choose another file.
  bad:oversized.jpg: oversized.jpg is 26,624.0 KB (27,262,976 bytes). The largest file this tool accepts is 25,600.0 KB (25 MB).
  replace: status after replace began with: "Image ready. Choose a size limit, then press Compress."; final download photo-under-50kb.jpg 47483 bytes
  network: page requests: GET /compress-image-to-kb/, GET /assets/css/style.css, GET /assets/img/favicon.svg, GET /assets/js/compressor.js, GET blob:/29eb5c80-f88f-4862-9092-ada0439969ad, GET blob:/cbf60c40-823a-4dd2-b270-04e7c66b9ae4; requests during processing: 0 network (2 local blob: preview loads); server saw 4 GETs with empty bodies; fetch() blocked by CSP
  presetChange: 200 KB run cancelled by switch to 50 KB; new download 47483 bytes
  customChange: 150 KB run cancelled by edit to 60 KB; new download 57907 bytes
  wide40: wide-noise.png -> 40905 bytes (limit 40960), 6400x32
  wide5: Could not get this image under 5 KB (5,120 bytes). No file was created.Even at the smallest size this tool allows, 6,400 × 32 px (shortest side 32 px), and 10% quality, the file was 7.10 KB (7,266 bytes). Choose a larger limit. [independent Chromium measurement: 7266 bytes; encodes 6]
  pages: 7 pages, 7 unique internal links checked; origin https://YOUR-DOMAIN.example; owner "OWNER-NAME-PLACEHOLDER"; email CONTACT-EMAIL-PLACEHOLDER
```

### Browser, configured copy
```
devMmX PhotoTools browser test report (configured copy)
Site folder: /tmp/phototools-copies-Nqrvtt/configured/site
Run at: 2026-10-06T11:10:36.923Z
Browser: Chromium 141.0.7390.37 (Playwright, headless, Linux)

PASS  Success: 3000x2000 JPEG to 100 KB, quality only, dimensions unchanged  (1543 ms)
PASS  Success: 1600x1200 WebP to 50 KB  (921 ms)
PASS  Success: custom 75 KB limit  (1363 ms)
PASS  Success: PNG with .jpg extension is detected by content  (664 ms)
PASS  Success with resize: noisy 2000x1500 PNG to 20 KB, smaller dims, same aspect ratio  (1123 ms)
PASS  Transparency: notice shown and transparent area becomes white  (752 ms)
PASS  Metadata: EXIF block in input is not present in output  (1285 ms)
PASS  Impossible target: 20 KB on noisy PNG without resize gives error, no download  (739 ms)
PASS  Already-small JPEG: note says it is already under the limit  (309 ms)
PASS  Rejects random-bytes.jpg with a clear error  (230 ms)
PASS  Rejects jpeg-garbage.jpg with a clear error  (268 ms)
PASS  Rejects truncated.jpg with a clear error  (257 ms)
PASS  Rejects text-renamed.png with a clear error  (298 ms)
PASS  Rejects huge-dimensions.png with a clear error  (286 ms)
PASS  Rejects bad-data.png with a clear error  (272 ms)
PASS  Rejects animation.gif with a clear error  (218 ms)
PASS  Rejects photo.heic with a clear error  (231 ms)
PASS  Rejects empty.jpg with a clear error  (298 ms)
PASS  Rejects oversized.jpg with a clear error  (228 ms)
PASS  Custom limit validation  (560 ms)
PASS  Reset clears image, result, download link and releases object URLs  (916 ms)
PASS  Replacing the image during processing cancels the old run (no stale result or download)  (4758 ms)
PASS  Choosing a new image after success removes the old download  (811 ms)
PASS  No image data is transmitted (request log, server log, CSP blocks connections)  (1188 ms)
PASS  Options are locked while compressing; picker and Start over stay usable  (1261 ms)
PASS  Preset change during a slowed encode cancels the run; new run uses the new limit  (3846 ms)
PASS  Custom-limit edit during a slowed encode cancels the run; new run uses the new limit  (3957 ms)
PASS  Resize-option change during a slowed encode cancels the run  (3579 ms)
PASS  Option changed without an event: finished result is discarded, not published  (983 ms)
PASS  Start over during processing cancels cleanly  (3609 ms)
PASS  Leaving mid-run (pagehide) and returning from back/forward cache (pageshow) gives a clean, usable tool  (4245 ms)
PASS  Wide 12000x60 noisy PNG to 40 KB with resizing: succeeds within limits (finding 4)  (843 ms)
PASS  Wide 12000x60 noisy PNG to 5 KB: honest "smallest allowed size" message with measured size  (660 ms)
PASS  Screenshots: mobile compressor before and after a successful result  (1778 ms)
PASS  Pages: status, unique titles/descriptions, one h1, canonical, internal links resolve  (1035 ms)
PASS  404: unknown path returns 404 page with noindex and working links  (196 ms)
PASS  Layout at 360px: no horizontal scroll on any page, touch targets >= 44px  (2318 ms)
PASS  Layout at 1280px: no horizontal scroll on any page  (2580 ms)
PASS  Keyboard: skip link first, file picker reachable by Tab with visible focus  (261 ms)
PASS  Without JavaScript: instructions readable, tool hidden, notice shown  (168 ms)

40 passed, 0 failed, 40 total

Details:
  jpg100: photo.jpg -> 93398 bytes (limit 102400), 3000x2000
  webp50: photo.webp -> 47483 bytes (limit 51200), 1600x1200
  custom75: photo.jpg -> 74696 bytes (limit 76800), 3000x2000
  pngnamedjpg: png-named-as.jpg -> 20144 bytes (limit 20480), 800x600
  noise20resize: noisy.png -> 19450 bytes (limit 20480), 362x272
  transparent: 50739 bytes; sampled pixels [[255,255,255,255],[255,255,255,255]]
  impossible: Could not get this image under 20 KB (20,480 bytes). No file was created.The smallest result was 248.3 KB (254,295 bytes) at 10% quality and the original 2,000 × 1,500 px.Lowering the quality alone wa [encodes: 2]
  bad:random-bytes.jpg: Unsupported file: random-bytes.jpg.This file is not a JPEG, PNG or WebP image. Renaming a file (for example .pdf to .jpg) does not change its format.
  bad:jpeg-garbage.jpg: jpeg-garbage.jpg could not be read as an image.The file looks damaged, or it is not really the format its name suggests. Try the original photo again.
  bad:truncated.jpg: truncated.jpg could not be read as an image.The JPEG file is incomplete. It may have been cut off while downloading or copying. Try the original photo again.
  bad:text-renamed.png: Unsupported file: text-renamed.png.This file is not a JPEG, PNG or WebP image. Renaming a file (for example .pdf to .jpg) does not change its format.
  bad:huge-dimensions.png: Image too large: huge-dimensions.png.This image is 20,000 × 20,000 px (400.0 megapixels). The limit is 40 megapixels and 12,000 px on the longest side, to avoid
  bad:bad-data.png: bad-data.png could not be opened. The file may be damaged, or your browser cannot decode it.
  bad:animation.gif: Unsupported file: animation.gif.This is a GIF file. This tool accepts JPEG, PNG and WebP only.
  bad:photo.heic: Unsupported file: photo.heic.This is a HEIC/HEIF photo. Convert it to JPEG first (some phone camera or gallery apps have a JPEG or "most compatible" option), th
  bad:empty.jpg: empty.jpg is empty (0 bytes). Choose another file.
  bad:oversized.jpg: oversized.jpg is 26,624.0 KB (27,262,976 bytes). The largest file this tool accepts is 25,600.0 KB (25 MB).
  replace: status after replace began with: "Image ready. Choose a size limit, then press Compress."; final download photo-under-50kb.jpg 47483 bytes
  network: page requests: GET /compress-image-to-kb/, GET /assets/css/style.css, GET /assets/img/favicon.svg, GET /assets/js/compressor.js, GET blob:/a039c0de-bd1d-4559-89ad-4e5d691f6df5, GET blob:/ac3f85f5-4cb7-4e08-ba4f-d945e6837c73; requests during processing: 0 network (2 local blob: preview loads); server saw 4 GETs with empty bodies; fetch() blocked by CSP
  presetChange: 200 KB run cancelled by switch to 50 KB; new download 47483 bytes
  customChange: 150 KB run cancelled by edit to 60 KB; new download 57907 bytes
  wide40: wide-noise.png -> 40905 bytes (limit 40960), 6400x32
  wide5: Could not get this image under 5 KB (5,120 bytes). No file was created.Even at the smallest size this tool allows, 6,400 × 32 px (shortest side 32 px), and 10% quality, the file was 7.10 KB (7,266 bytes). Choose a larger limit. [independent Chromium measurement: 7266 bytes; encodes 6]
  pages: 7 pages, 7 unique internal links checked; origin https://phototools-test.example.com; owner "Test Owner & Co"; email owner@phototools-test.example.com
```

The "Details" lines join paragraphs without spaces because they are read with `textContent`.

## Existing compressor regressions

All 40 browser tests from Stage 1.1 are unchanged and passed in all four browser runs (2 states × template/configured). They include option locking and cancellation during slowed encodes, the 12000×60 thin-image cases, reset during processing, and the pagehide/pageshow restore. Each successful download was checked for byte count, JPEG signature, frame-header dimensions and a re-decode in Chromium. The compressor JavaScript was not changed in 1.1.1.

## Not tested / could not run

- Real Android phones and Android Chrome. Mobile layout was checked only with a 360 × 740 Chromium viewport and touch emulation.
- Firefox, Safari, Samsung Internet and Edge.
- A real back/forward-cache navigation (simulated with `PageTransitionEvent`s).
- The 40-attempt-budget message path (no fixture triggers it without a test-only hook).
- Node.js 18, and Cloudflare's build image.
- The real GitHub Actions workflows and Cloudflare Pages build gate.
- A real 40-megapixel image, real camera photos with EXIF orientation, screen readers, automated accessibility checkers and slow devices.
- Windows paths. `config.mjs` normalises `\` to `/` for page names, but it was run only on Linux.
