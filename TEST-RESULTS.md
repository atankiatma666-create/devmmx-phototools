# Test results — Stage 2A with review corrections (2A.1)

Executed on 6 October 2026 in a Linux container with Node.js 22.22.2, Playwright 1.56 and Chromium 141.0.7390.37 (headless). All images are synthetic fixtures from `tests/generate-fixtures.mjs`.

## 2A.1 corrections

1. **Result wording about the 70% setting.** The note is now chosen from what actually happened:
   - **Shrunk, setting 70% or higher:** "To keep the setting at 70% or higher, the image was made smaller…"
   - **Shrunk to the smallest allowed size, still below 70%:** "The image was made smaller, to N% of the original width…, which is the smallest size this tool allows… Even at that size it did not fit at a setting of 70%, so the setting had to go down to X%."
   - **Resizing on, but already at the smallest size:** "This image is already at the smallest size this tool allows…, so it could not be made smaller, and the setting had to go down to X%."
   - **Resizing off, below 70%:** turning resizing on "usually" keeps 70% or higher, followed by "That is not always possible…".

   The checkbox hint, the page's quality section, the Android guide and the README no longer describe a universal 70% floor.
2. **Preview limitation disclosed visibly.**
   - When the original is larger than 1,600 px, its caption reads "Original, scaled preview: shown from a W × H px copy. Your file is …".
   - A visible note says the preview is capped at 1,600 px to save memory and that deep zoom cannot show all original detail. It tells users to check the original file and the downloaded JPEG in their gallery or file viewer.
   - When the original is no larger than 1,600 px, the caption says "(preview at full size)" and the note is hidden.
   - The result caption now says it is "the downloaded JPEG itself".
   - The memory cap is unchanged.

Unchanged: the compression algorithm, configuration tools and workflows. The suite confirms identical output bytes to Stage 2A for detailed 200 KB with resizing on (196,930), detailed 200 KB with resizing off (200,565) and thin 12000×60 at 40 KB (40,905).

Note: the working copy again held undelivered edits from an interrupted session. They were set aside; this release was rebuilt from the delivered Stage 2A ZIP.

## Reproduction before the fix

The new suite was run against the unmodified delivered Stage 2A site:
```
SITE_DIR=<delivered Stage 2A>/site RESULTS_DIR=/tmp/old2a-results node tests/run-tests.mjs
```
Result: 44 passed, 7 failed.
- The thin 12000×60 image at 40 KB with resizing on gave 6400×32, 40,905 bytes, **setting 45%** in Chromium. ChatGPT's native encoder gave about 33%; encoders differ.
- Its note read: "…To keep the setting at 70% or higher, the image was made smaller: 53% of the original width… Even at the smallest size this tool allows, the setting had to go below 70%…". That is contradictory, and it is the reported bug.
- The other failures were the new wording and preview checks: the resize-off recommendation, the strip case, and the full-size and scaled preview labels.

After the fix, the same scenario's note reads: "The image was made smaller, to 53% of the original width (same shape), which is the smallest size this tool allows (32 px on the shortest side). Even at that size it did not fit at a setting of 70%, so the setting had to go down to 45%."

## Commands and results

State A, a fresh extract of the candidate ZIP (unconfigured):
```
node tests/generate-fixtures.mjs
node tools/config.mjs status      # Consistent, but setup incomplete
node tests/run-all.mjs            # exit 0
```
State B, the same folder configured:
```
node tools/config.mjs set --domain myphoto.example.com --name Sem --email sem@example.com
node tools/config.mjs prepublish  # Ready to publish
node tests/run-all.mjs            # exit 0
```
The owner's `site/` plus `site.config.json` fingerprint was `a2707e55ecb941fe…` before and after state B. `run-all.mjs` also checks this in both states.

| | Configuration | Browser, template copy | Browser, configured copy | Owner files unchanged |
|---|---|---|---|---|
| State A (fresh ZIP) | 29/29 | 51/51 | 51/51 | yes |
| State B (configured repo) | 29/29 | 51/51 | 51/51 | yes |

## New and changed tests in 2A.1 (51 browser tests; 49 from Stage 2A plus 2 new)

- **Every success test:** if the shown setting is below 70%, the note must not contain "To keep the setting at 70% or higher". If it is 70% or more, the note must not say the setting "had to go down".
- **Thin 12000×60 at 40 KB, resizing on (changed):**
  - a setting below 70% is allowed only at the smallest size (6400×32);
  - the note must say the image was made smaller to the smallest allowed size and name the actual setting ("had to go down to 45%").
- **New: strip 3000×30 at 20 KB, resizing on.** The image is already at the smallest size. An independent Chromium measurement confirms full size at 70% is 51,397 bytes, over the limit. The result is 3000×30 at 23%. The note must say it "could not be made smaller" and must not claim resizing happened.
- **Resize off, detailed (changed):** the recommendation must say "usually" and "That is not always possible".
- **Resize on, detailed (changed):** must contain the exact "To keep the setting at 70% or higher, the image was made smaller" sentence.
- **Previews at 360 px and 1280 px (changed):**
  - they wait until both images are complete with `naturalWidth > 0` before measuring;
  - the original preview must have loaded at 1600 px, and the result preview at the downloaded JPEG's width;
  - the boxes must be equal;
  - the captions must include "scaled preview", the preview size, the real file size, and "the downloaded JPEG itself";
  - the limitation note must be visible.
- **New: an original of 1600×1200** is labelled "(preview at full size)" with the note hidden.

## Reports, state A (verbatim)

### Configuration
```
devMmX PhotoTools configuration tests
Run at: 2026-10-06T16:57:45.004Z
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
Site folder: /tmp/phototools-copies-jipedQ/template/site
Run at: 2026-10-06T16:58:56.118Z
Browser: Chromium 141.0.7390.37 (Playwright, headless, Linux)

PASS  Success: 3000x2000 JPEG to 100 KB, quality only, dimensions unchanged  (1497 ms)
PASS  Success: 1600x1200 WebP to 50 KB  (937 ms)
PASS  Success: custom 75 KB limit  (1569 ms)
PASS  Success: PNG with .jpg extension is detected by content  (600 ms)
PASS  Success with resize: noisy 2000x1500 PNG to 20 KB, smaller dims, same aspect ratio  (1132 ms)
PASS  Transparency: notice shown and transparent area becomes white  (883 ms)
PASS  Metadata: EXIF block in input is not present in output  (1288 ms)
PASS  Impossible target: 20 KB on noisy PNG without resize gives error, no download  (961 ms)
PASS  Already-small JPEG: note says it is already under the limit  (264 ms)
PASS  Rejects random-bytes.jpg with a clear error  (230 ms)
PASS  Rejects jpeg-garbage.jpg with a clear error  (221 ms)
PASS  Rejects truncated.jpg with a clear error  (274 ms)
PASS  Rejects text-renamed.png with a clear error  (227 ms)
PASS  Rejects huge-dimensions.png with a clear error  (309 ms)
PASS  Rejects bad-data.png with a clear error  (325 ms)
PASS  Rejects animation.gif with a clear error  (194 ms)
PASS  Rejects photo.heic with a clear error  (225 ms)
PASS  Rejects empty.jpg with a clear error  (201 ms)
PASS  Rejects oversized.jpg with a clear error  (210 ms)
PASS  Custom limit validation  (636 ms)
PASS  Reset clears image, result, download link and releases object URLs  (805 ms)
PASS  Replacing the image during processing cancels the old run (no stale result or download)  (4852 ms)
PASS  Choosing a new image after success removes the old download  (872 ms)
PASS  No image data is transmitted (request log, server log, CSP blocks connections)  (1272 ms)
PASS  Options are locked while compressing; picker and Start over stay usable  (1442 ms)
PASS  Preset change during a slowed encode cancels the run; new run uses the new limit  (4015 ms)
PASS  Custom-limit edit during a slowed encode cancels the run; new run uses the new limit  (4003 ms)
PASS  Resize-option change during a slowed encode cancels the run  (3660 ms)
PASS  Option changed without an event: finished result is discarded, not published  (1103 ms)
PASS  Start over during processing cancels cleanly  (3764 ms)
PASS  Leaving mid-run (pagehide) and returning from back/forward cache (pageshow) gives a clean, usable tool  (4549 ms)
PASS  Wide 12000x60 noisy PNG to 40 KB with resizing: succeeds within limits (finding 4)  (826 ms)
PASS  Wide 12000x60 noisy PNG to 5 KB: honest "smallest allowed size" message with measured size  (582 ms)
PASS  Screenshots: mobile compressor before and after a successful result  (2617 ms)
PASS  Resize OFF, detailed 4000x3000 to 200 KB: dimensions kept, low setting explained  (1961 ms)
PASS  Resize ON, detailed 4000x3000 to 200 KB: smaller dimensions, setting at least 70%, full size at 70% measured too big  (3432 ms)
PASS  Resize ON, 70% fits at full size: dimensions kept, setting between 70% and 92%  (1150 ms)
PASS  Resize ON never enlarges: small 300x200 image keeps its size at 92%  (466 ms)
PASS  Resize ON, thin 12000x60 image to 40 KB: 70%+ unless at the smallest allowed size  (834 ms)
PASS  Impossible with resize OFF: detailed 4000x3000 to 100 KB gives an accurate error and no download  (1014 ms)
PASS  Resize option switched OFF during a slowed resize-first run cancels it  (3843 ms)
PASS  Resize ON, 3000x30 strip already at the smallest size: not resized, setting below 70% explained accurately  (672 ms)
PASS  Preview of an original no larger than 1,600 px is labelled full size, without the scaled-preview note  (932 ms)
PASS  Previews: original and result shown at the same size with real pixels and bytes (360px)  (1679 ms)
PASS  Previews: original and result shown at the same size with real pixels and bytes (1280px)  (1809 ms)
PASS  Pages: status, unique titles/descriptions, one h1, canonical, internal links resolve  (929 ms)
PASS  404: unknown path returns 404 page with noindex and working links  (139 ms)
PASS  Layout at 360px: no horizontal scroll on any page, touch targets >= 44px  (1945 ms)
PASS  Layout at 1280px: no horizontal scroll on any page  (2452 ms)
PASS  Keyboard: skip link first, file picker reachable by Tab with visible focus  (245 ms)
PASS  Without JavaScript: instructions readable, tool hidden, notice shown  (174 ms)

51 passed, 0 failed, 51 total

Details:
  jpg100: photo.jpg -> 93398 bytes (limit 102400), 3000x2000, setting 12%
  webp50: photo.webp -> 47483 bytes (limit 51200), 1600x1200, setting 14%
  custom75: photo.jpg -> 74696 bytes (limit 76800), 3000x2000, setting 10%
  pngnamedjpg: png-named-as.jpg -> 20144 bytes (limit 20480), 800x600, setting 19%
  noise20resize: noisy.png -> 19248 bytes (limit 20480), 418x313, setting 71%
  transparent: 50739 bytes; sampled pixels [[255,255,255,255],[255,255,255,255]]
  impossible: Could not get this image under 20 KB (20,480 bytes). No file was created.The smallest result was 248.3 KB (254,295 bytes) at an encoder setting of 10% and the original 2,000 × 1,500 px.Lowering the qu [encodes: 2]
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
  network: page requests: GET /compress-image-to-kb/, GET /assets/css/style.css, GET /assets/img/favicon.svg, GET /assets/js/compressor.js, GET blob:/aacc0efc-31b7-4955-8f35-af4c8876a871, GET blob:/803b65e9-8fbc-42cb-accc-cc3a3e48a1ea; requests during processing: 0 network (2 local blob: preview loads); server saw 4 GETs with empty bodies; fetch() blocked by CSP
  presetChange: 200 KB run cancelled by switch to 50 KB; new download 47483 bytes
  customChange: 150 KB run cancelled by edit to 60 KB; new download 57907 bytes
  wide40: wide-noise.png -> 40905 bytes (limit 40960), 6400x32, setting 45%
  wide5: Could not get this image under 5 KB (5,120 bytes). No file was created.Even at the smallest size this tool allows, 6,400 × 32 px (shortest side 32 px), and an encoder setting of 10%, the file was 7.10 KB (7,266 bytes). Choose a la [independent Chromium measurement: 7266 bytes; encodes 5]
  detailed200off: detailed.jpg -> 200565 bytes (limit 204800), 4000x3000, setting 15%
  detailed200on: detailed.jpg -> 196930 bytes (limit 204800), 1836x1377, setting 71%; full size at 70% = 1447846 bytes (over limit); 5% larger (1928x1446) at 70% = 211610 bytes (over limit)
  webp500on: photo.webp -> 503453 bytes (limit 512000), 1600x1200, setting 79%
  wide40on: wide-noise.png -> 40905 bytes (limit 40960), 6400x32, setting 45% (at smallest allowed size) | note: "The image was made smaller, to 53% of the original width (same shape), which is the smallest size this tool allows (32 px on the shortest side). Even at that size it did not fit at a setting of 70%, so the setting had to go down to 45%."
  strip20on: strip-noise.png -> 20142 bytes (limit 20480), 3000x30, setting 23%; full size at 70% = 51397 bytes (over limit)
  previews360: boxes 260x195 and 260x195 css px; Result: the downloaded JPEG itself, 1,836 × 1,377 px, 192.3 KB (196,930 bytes), setting 71%.
  previews1280: boxes 405x303 and 405x303 css px; Result: the downloaded JPEG itself, 1,836 × 1,377 px, 192.3 KB (196,930 bytes), setting 71%.
  pages: 7 pages, 7 unique internal links checked; origin https://YOUR-DOMAIN.example; owner "OWNER-NAME-PLACEHOLDER"; email CONTACT-EMAIL-PLACEHOLDER
```

### Browser, configured copy
```
devMmX PhotoTools browser test report (configured copy)
Site folder: /tmp/phototools-copies-jipedQ/configured/site
Run at: 2026-10-06T17:00:07.448Z
Browser: Chromium 141.0.7390.37 (Playwright, headless, Linux)

PASS  Success: 3000x2000 JPEG to 100 KB, quality only, dimensions unchanged  (1550 ms)
PASS  Success: 1600x1200 WebP to 50 KB  (992 ms)
PASS  Success: custom 75 KB limit  (1477 ms)
PASS  Success: PNG with .jpg extension is detected by content  (580 ms)
PASS  Success with resize: noisy 2000x1500 PNG to 20 KB, smaller dims, same aspect ratio  (1188 ms)
PASS  Transparency: notice shown and transparent area becomes white  (848 ms)
PASS  Metadata: EXIF block in input is not present in output  (1404 ms)
PASS  Impossible target: 20 KB on noisy PNG without resize gives error, no download  (869 ms)
PASS  Already-small JPEG: note says it is already under the limit  (273 ms)
PASS  Rejects random-bytes.jpg with a clear error  (313 ms)
PASS  Rejects jpeg-garbage.jpg with a clear error  (216 ms)
PASS  Rejects truncated.jpg with a clear error  (214 ms)
PASS  Rejects text-renamed.png with a clear error  (210 ms)
PASS  Rejects huge-dimensions.png with a clear error  (276 ms)
PASS  Rejects bad-data.png with a clear error  (284 ms)
PASS  Rejects animation.gif with a clear error  (266 ms)
PASS  Rejects photo.heic with a clear error  (265 ms)
PASS  Rejects empty.jpg with a clear error  (204 ms)
PASS  Rejects oversized.jpg with a clear error  (200 ms)
PASS  Custom limit validation  (615 ms)
PASS  Reset clears image, result, download link and releases object URLs  (873 ms)
PASS  Replacing the image during processing cancels the old run (no stale result or download)  (4822 ms)
PASS  Choosing a new image after success removes the old download  (915 ms)
PASS  No image data is transmitted (request log, server log, CSP blocks connections)  (1324 ms)
PASS  Options are locked while compressing; picker and Start over stay usable  (1363 ms)
PASS  Preset change during a slowed encode cancels the run; new run uses the new limit  (3954 ms)
PASS  Custom-limit edit during a slowed encode cancels the run; new run uses the new limit  (4045 ms)
PASS  Resize-option change during a slowed encode cancels the run  (3700 ms)
PASS  Option changed without an event: finished result is discarded, not published  (1097 ms)
PASS  Start over during processing cancels cleanly  (3829 ms)
PASS  Leaving mid-run (pagehide) and returning from back/forward cache (pageshow) gives a clean, usable tool  (4406 ms)
PASS  Wide 12000x60 noisy PNG to 40 KB with resizing: succeeds within limits (finding 4)  (744 ms)
PASS  Wide 12000x60 noisy PNG to 5 KB: honest "smallest allowed size" message with measured size  (589 ms)
PASS  Screenshots: mobile compressor before and after a successful result  (2652 ms)
PASS  Resize OFF, detailed 4000x3000 to 200 KB: dimensions kept, low setting explained  (2084 ms)
PASS  Resize ON, detailed 4000x3000 to 200 KB: smaller dimensions, setting at least 70%, full size at 70% measured too big  (3613 ms)
PASS  Resize ON, 70% fits at full size: dimensions kept, setting between 70% and 92%  (1101 ms)
PASS  Resize ON never enlarges: small 300x200 image keeps its size at 92%  (449 ms)
PASS  Resize ON, thin 12000x60 image to 40 KB: 70%+ unless at the smallest allowed size  (951 ms)
PASS  Impossible with resize OFF: detailed 4000x3000 to 100 KB gives an accurate error and no download  (1043 ms)
PASS  Resize option switched OFF during a slowed resize-first run cancels it  (3845 ms)
PASS  Resize ON, 3000x30 strip already at the smallest size: not resized, setting below 70% explained accurately  (700 ms)
PASS  Preview of an original no larger than 1,600 px is labelled full size, without the scaled-preview note  (1021 ms)
PASS  Previews: original and result shown at the same size with real pixels and bytes (360px)  (1746 ms)
PASS  Previews: original and result shown at the same size with real pixels and bytes (1280px)  (1602 ms)
PASS  Pages: status, unique titles/descriptions, one h1, canonical, internal links resolve  (732 ms)
PASS  404: unknown path returns 404 page with noindex and working links  (167 ms)
PASS  Layout at 360px: no horizontal scroll on any page, touch targets >= 44px  (2056 ms)
PASS  Layout at 1280px: no horizontal scroll on any page  (2347 ms)
PASS  Keyboard: skip link first, file picker reachable by Tab with visible focus  (269 ms)
PASS  Without JavaScript: instructions readable, tool hidden, notice shown  (155 ms)

51 passed, 0 failed, 51 total

Details:
  jpg100: photo.jpg -> 93398 bytes (limit 102400), 3000x2000, setting 12%
  webp50: photo.webp -> 47483 bytes (limit 51200), 1600x1200, setting 14%
  custom75: photo.jpg -> 74696 bytes (limit 76800), 3000x2000, setting 10%
  pngnamedjpg: png-named-as.jpg -> 20144 bytes (limit 20480), 800x600, setting 19%
  noise20resize: noisy.png -> 19248 bytes (limit 20480), 418x313, setting 71%
  transparent: 50739 bytes; sampled pixels [[255,255,255,255],[255,255,255,255]]
  impossible: Could not get this image under 20 KB (20,480 bytes). No file was created.The smallest result was 248.3 KB (254,295 bytes) at an encoder setting of 10% and the original 2,000 × 1,500 px.Lowering the qu [encodes: 2]
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
  network: page requests: GET /compress-image-to-kb/, GET /assets/css/style.css, GET /assets/img/favicon.svg, GET /assets/js/compressor.js, GET blob:/75500acc-0105-4971-807b-0e0016dd8c5e, GET blob:/19810df8-4203-4abc-85c8-ffa7ddfae048; requests during processing: 0 network (2 local blob: preview loads); server saw 4 GETs with empty bodies; fetch() blocked by CSP
  presetChange: 200 KB run cancelled by switch to 50 KB; new download 47483 bytes
  customChange: 150 KB run cancelled by edit to 60 KB; new download 57907 bytes
  wide40: wide-noise.png -> 40905 bytes (limit 40960), 6400x32, setting 45%
  wide5: Could not get this image under 5 KB (5,120 bytes). No file was created.Even at the smallest size this tool allows, 6,400 × 32 px (shortest side 32 px), and an encoder setting of 10%, the file was 7.10 KB (7,266 bytes). Choose a la [independent Chromium measurement: 7266 bytes; encodes 5]
  detailed200off: detailed.jpg -> 200565 bytes (limit 204800), 4000x3000, setting 15%
  detailed200on: detailed.jpg -> 196930 bytes (limit 204800), 1836x1377, setting 71%; full size at 70% = 1447846 bytes (over limit); 5% larger (1928x1446) at 70% = 211610 bytes (over limit)
  webp500on: photo.webp -> 503453 bytes (limit 512000), 1600x1200, setting 79%
  wide40on: wide-noise.png -> 40905 bytes (limit 40960), 6400x32, setting 45% (at smallest allowed size) | note: "The image was made smaller, to 53% of the original width (same shape), which is the smallest size this tool allows (32 px on the shortest side). Even at that size it did not fit at a setting of 70%, so the setting had to go down to 45%."
  strip20on: strip-noise.png -> 20142 bytes (limit 20480), 3000x30, setting 23%; full size at 70% = 51397 bytes (over limit)
  previews360: boxes 260x195 and 260x195 css px; Result: the downloaded JPEG itself, 1,836 × 1,377 px, 192.3 KB (196,930 bytes), setting 71%.
  previews1280: boxes 405x303 and 405x303 css px; Result: the downloaded JPEG itself, 1,836 × 1,377 px, 192.3 KB (196,930 bytes), setting 71%.
  pages: 7 pages, 7 unique internal links checked; origin https://phototools-test.example.com; owner "Test Owner & Co"; email owner@phototools-test.example.com
```

## Reports, state B (verbatim)

### Configuration
```
devMmX PhotoTools configuration tests
Run at: 2026-10-06T17:00:16.193Z
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
Site folder: /tmp/phototools-copies-juNNJR/template/site
Run at: 2026-10-06T17:01:25.805Z
Browser: Chromium 141.0.7390.37 (Playwright, headless, Linux)

PASS  Success: 3000x2000 JPEG to 100 KB, quality only, dimensions unchanged  (1461 ms)
PASS  Success: 1600x1200 WebP to 50 KB  (941 ms)
PASS  Success: custom 75 KB limit  (1253 ms)
PASS  Success: PNG with .jpg extension is detected by content  (580 ms)
PASS  Success with resize: noisy 2000x1500 PNG to 20 KB, smaller dims, same aspect ratio  (1180 ms)
PASS  Transparency: notice shown and transparent area becomes white  (809 ms)
PASS  Metadata: EXIF block in input is not present in output  (1300 ms)
PASS  Impossible target: 20 KB on noisy PNG without resize gives error, no download  (794 ms)
PASS  Already-small JPEG: note says it is already under the limit  (216 ms)
PASS  Rejects random-bytes.jpg with a clear error  (206 ms)
PASS  Rejects jpeg-garbage.jpg with a clear error  (209 ms)
PASS  Rejects truncated.jpg with a clear error  (208 ms)
PASS  Rejects text-renamed.png with a clear error  (226 ms)
PASS  Rejects huge-dimensions.png with a clear error  (247 ms)
PASS  Rejects bad-data.png with a clear error  (224 ms)
PASS  Rejects animation.gif with a clear error  (231 ms)
PASS  Rejects photo.heic with a clear error  (219 ms)
PASS  Rejects empty.jpg with a clear error  (226 ms)
PASS  Rejects oversized.jpg with a clear error  (203 ms)
PASS  Custom limit validation  (648 ms)
PASS  Reset clears image, result, download link and releases object URLs  (849 ms)
PASS  Replacing the image during processing cancels the old run (no stale result or download)  (4917 ms)
PASS  Choosing a new image after success removes the old download  (997 ms)
PASS  No image data is transmitted (request log, server log, CSP blocks connections)  (1293 ms)
PASS  Options are locked while compressing; picker and Start over stay usable  (1430 ms)
PASS  Preset change during a slowed encode cancels the run; new run uses the new limit  (3950 ms)
PASS  Custom-limit edit during a slowed encode cancels the run; new run uses the new limit  (3966 ms)
PASS  Resize-option change during a slowed encode cancels the run  (3635 ms)
PASS  Option changed without an event: finished result is discarded, not published  (1012 ms)
PASS  Start over during processing cancels cleanly  (3808 ms)
PASS  Leaving mid-run (pagehide) and returning from back/forward cache (pageshow) gives a clean, usable tool  (4340 ms)
PASS  Wide 12000x60 noisy PNG to 40 KB with resizing: succeeds within limits (finding 4)  (726 ms)
PASS  Wide 12000x60 noisy PNG to 5 KB: honest "smallest allowed size" message with measured size  (598 ms)
PASS  Screenshots: mobile compressor before and after a successful result  (2434 ms)
PASS  Resize OFF, detailed 4000x3000 to 200 KB: dimensions kept, low setting explained  (2006 ms)
PASS  Resize ON, detailed 4000x3000 to 200 KB: smaller dimensions, setting at least 70%, full size at 70% measured too big  (3529 ms)
PASS  Resize ON, 70% fits at full size: dimensions kept, setting between 70% and 92%  (1102 ms)
PASS  Resize ON never enlarges: small 300x200 image keeps its size at 92%  (430 ms)
PASS  Resize ON, thin 12000x60 image to 40 KB: 70%+ unless at the smallest allowed size  (796 ms)
PASS  Impossible with resize OFF: detailed 4000x3000 to 100 KB gives an accurate error and no download  (1107 ms)
PASS  Resize option switched OFF during a slowed resize-first run cancels it  (3818 ms)
PASS  Resize ON, 3000x30 strip already at the smallest size: not resized, setting below 70% explained accurately  (783 ms)
PASS  Preview of an original no larger than 1,600 px is labelled full size, without the scaled-preview note  (921 ms)
PASS  Previews: original and result shown at the same size with real pixels and bytes (360px)  (1637 ms)
PASS  Previews: original and result shown at the same size with real pixels and bytes (1280px)  (1738 ms)
PASS  Pages: status, unique titles/descriptions, one h1, canonical, internal links resolve  (739 ms)
PASS  404: unknown path returns 404 page with noindex and working links  (146 ms)
PASS  Layout at 360px: no horizontal scroll on any page, touch targets >= 44px  (1964 ms)
PASS  Layout at 1280px: no horizontal scroll on any page  (2352 ms)
PASS  Keyboard: skip link first, file picker reachable by Tab with visible focus  (217 ms)
PASS  Without JavaScript: instructions readable, tool hidden, notice shown  (141 ms)

51 passed, 0 failed, 51 total

Details:
  jpg100: photo.jpg -> 93398 bytes (limit 102400), 3000x2000, setting 12%
  webp50: photo.webp -> 47483 bytes (limit 51200), 1600x1200, setting 14%
  custom75: photo.jpg -> 74696 bytes (limit 76800), 3000x2000, setting 10%
  pngnamedjpg: png-named-as.jpg -> 20144 bytes (limit 20480), 800x600, setting 19%
  noise20resize: noisy.png -> 19248 bytes (limit 20480), 418x313, setting 71%
  transparent: 50739 bytes; sampled pixels [[255,255,255,255],[255,255,255,255]]
  impossible: Could not get this image under 20 KB (20,480 bytes). No file was created.The smallest result was 248.3 KB (254,295 bytes) at an encoder setting of 10% and the original 2,000 × 1,500 px.Lowering the qu [encodes: 2]
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
  network: page requests: GET /compress-image-to-kb/, GET /assets/css/style.css, GET /assets/img/favicon.svg, GET /assets/js/compressor.js, GET blob:/9ff857bf-45d0-455b-82b7-68c06835dc05, GET blob:/e3c0d49d-c52e-45b6-ace6-5be9cdaba766; requests during processing: 0 network (2 local blob: preview loads); server saw 4 GETs with empty bodies; fetch() blocked by CSP
  presetChange: 200 KB run cancelled by switch to 50 KB; new download 47483 bytes
  customChange: 150 KB run cancelled by edit to 60 KB; new download 57907 bytes
  wide40: wide-noise.png -> 40905 bytes (limit 40960), 6400x32, setting 45%
  wide5: Could not get this image under 5 KB (5,120 bytes). No file was created.Even at the smallest size this tool allows, 6,400 × 32 px (shortest side 32 px), and an encoder setting of 10%, the file was 7.10 KB (7,266 bytes). Choose a la [independent Chromium measurement: 7266 bytes; encodes 5]
  detailed200off: detailed.jpg -> 200565 bytes (limit 204800), 4000x3000, setting 15%
  detailed200on: detailed.jpg -> 196930 bytes (limit 204800), 1836x1377, setting 71%; full size at 70% = 1447846 bytes (over limit); 5% larger (1928x1446) at 70% = 211610 bytes (over limit)
  webp500on: photo.webp -> 503453 bytes (limit 512000), 1600x1200, setting 79%
  wide40on: wide-noise.png -> 40905 bytes (limit 40960), 6400x32, setting 45% (at smallest allowed size) | note: "The image was made smaller, to 53% of the original width (same shape), which is the smallest size this tool allows (32 px on the shortest side). Even at that size it did not fit at a setting of 70%, so the setting had to go down to 45%."
  strip20on: strip-noise.png -> 20142 bytes (limit 20480), 3000x30, setting 23%; full size at 70% = 51397 bytes (over limit)
  previews360: boxes 260x195 and 260x195 css px; Result: the downloaded JPEG itself, 1,836 × 1,377 px, 192.3 KB (196,930 bytes), setting 71%.
  previews1280: boxes 405x303 and 405x303 css px; Result: the downloaded JPEG itself, 1,836 × 1,377 px, 192.3 KB (196,930 bytes), setting 71%.
  pages: 7 pages, 7 unique internal links checked; origin https://YOUR-DOMAIN.example; owner "OWNER-NAME-PLACEHOLDER"; email CONTACT-EMAIL-PLACEHOLDER
```

### Browser, configured copy
```
devMmX PhotoTools browser test report (configured copy)
Site folder: /tmp/phototools-copies-juNNJR/configured/site
Run at: 2026-10-06T17:02:36.189Z
Browser: Chromium 141.0.7390.37 (Playwright, headless, Linux)

PASS  Success: 3000x2000 JPEG to 100 KB, quality only, dimensions unchanged  (1504 ms)
PASS  Success: 1600x1200 WebP to 50 KB  (971 ms)
PASS  Success: custom 75 KB limit  (1415 ms)
PASS  Success: PNG with .jpg extension is detected by content  (597 ms)
PASS  Success with resize: noisy 2000x1500 PNG to 20 KB, smaller dims, same aspect ratio  (1152 ms)
PASS  Transparency: notice shown and transparent area becomes white  (822 ms)
PASS  Metadata: EXIF block in input is not present in output  (1365 ms)
PASS  Impossible target: 20 KB on noisy PNG without resize gives error, no download  (760 ms)
PASS  Already-small JPEG: note says it is already under the limit  (233 ms)
PASS  Rejects random-bytes.jpg with a clear error  (215 ms)
PASS  Rejects jpeg-garbage.jpg with a clear error  (227 ms)
PASS  Rejects truncated.jpg with a clear error  (213 ms)
PASS  Rejects text-renamed.png with a clear error  (225 ms)
PASS  Rejects huge-dimensions.png with a clear error  (210 ms)
PASS  Rejects bad-data.png with a clear error  (201 ms)
PASS  Rejects animation.gif with a clear error  (201 ms)
PASS  Rejects photo.heic with a clear error  (208 ms)
PASS  Rejects empty.jpg with a clear error  (240 ms)
PASS  Rejects oversized.jpg with a clear error  (224 ms)
PASS  Custom limit validation  (626 ms)
PASS  Reset clears image, result, download link and releases object URLs  (839 ms)
PASS  Replacing the image during processing cancels the old run (no stale result or download)  (4908 ms)
PASS  Choosing a new image after success removes the old download  (904 ms)
PASS  No image data is transmitted (request log, server log, CSP blocks connections)  (1280 ms)
PASS  Options are locked while compressing; picker and Start over stay usable  (1445 ms)
PASS  Preset change during a slowed encode cancels the run; new run uses the new limit  (3901 ms)
PASS  Custom-limit edit during a slowed encode cancels the run; new run uses the new limit  (4097 ms)
PASS  Resize-option change during a slowed encode cancels the run  (3846 ms)
PASS  Option changed without an event: finished result is discarded, not published  (1134 ms)
PASS  Start over during processing cancels cleanly  (3686 ms)
PASS  Leaving mid-run (pagehide) and returning from back/forward cache (pageshow) gives a clean, usable tool  (4507 ms)
PASS  Wide 12000x60 noisy PNG to 40 KB with resizing: succeeds within limits (finding 4)  (837 ms)
PASS  Wide 12000x60 noisy PNG to 5 KB: honest "smallest allowed size" message with measured size  (581 ms)
PASS  Screenshots: mobile compressor before and after a successful result  (2472 ms)
PASS  Resize OFF, detailed 4000x3000 to 200 KB: dimensions kept, low setting explained  (2050 ms)
PASS  Resize ON, detailed 4000x3000 to 200 KB: smaller dimensions, setting at least 70%, full size at 70% measured too big  (3367 ms)
PASS  Resize ON, 70% fits at full size: dimensions kept, setting between 70% and 92%  (1181 ms)
PASS  Resize ON never enlarges: small 300x200 image keeps its size at 92%  (495 ms)
PASS  Resize ON, thin 12000x60 image to 40 KB: 70%+ unless at the smallest allowed size  (820 ms)
PASS  Impossible with resize OFF: detailed 4000x3000 to 100 KB gives an accurate error and no download  (977 ms)
PASS  Resize option switched OFF during a slowed resize-first run cancels it  (3686 ms)
PASS  Resize ON, 3000x30 strip already at the smallest size: not resized, setting below 70% explained accurately  (713 ms)
PASS  Preview of an original no larger than 1,600 px is labelled full size, without the scaled-preview note  (994 ms)
PASS  Previews: original and result shown at the same size with real pixels and bytes (360px)  (1702 ms)
PASS  Previews: original and result shown at the same size with real pixels and bytes (1280px)  (1661 ms)
PASS  Pages: status, unique titles/descriptions, one h1, canonical, internal links resolve  (696 ms)
PASS  404: unknown path returns 404 page with noindex and working links  (146 ms)
PASS  Layout at 360px: no horizontal scroll on any page, touch targets >= 44px  (2262 ms)
PASS  Layout at 1280px: no horizontal scroll on any page  (2343 ms)
PASS  Keyboard: skip link first, file picker reachable by Tab with visible focus  (224 ms)
PASS  Without JavaScript: instructions readable, tool hidden, notice shown  (131 ms)

51 passed, 0 failed, 51 total

Details:
  jpg100: photo.jpg -> 93398 bytes (limit 102400), 3000x2000, setting 12%
  webp50: photo.webp -> 47483 bytes (limit 51200), 1600x1200, setting 14%
  custom75: photo.jpg -> 74696 bytes (limit 76800), 3000x2000, setting 10%
  pngnamedjpg: png-named-as.jpg -> 20144 bytes (limit 20480), 800x600, setting 19%
  noise20resize: noisy.png -> 19248 bytes (limit 20480), 418x313, setting 71%
  transparent: 50739 bytes; sampled pixels [[255,255,255,255],[255,255,255,255]]
  impossible: Could not get this image under 20 KB (20,480 bytes). No file was created.The smallest result was 248.3 KB (254,295 bytes) at an encoder setting of 10% and the original 2,000 × 1,500 px.Lowering the qu [encodes: 2]
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
  network: page requests: GET /compress-image-to-kb/, GET /assets/css/style.css, GET /assets/img/favicon.svg, GET /assets/js/compressor.js, GET blob:/0c199188-8908-4653-935e-2c6d0b2b7b8f, GET blob:/678b05fa-6bc4-4dbd-afdf-bb167bff30e9; requests during processing: 0 network (2 local blob: preview loads); server saw 4 GETs with empty bodies; fetch() blocked by CSP
  presetChange: 200 KB run cancelled by switch to 50 KB; new download 47483 bytes
  customChange: 150 KB run cancelled by edit to 60 KB; new download 57907 bytes
  wide40: wide-noise.png -> 40905 bytes (limit 40960), 6400x32, setting 45%
  wide5: Could not get this image under 5 KB (5,120 bytes). No file was created.Even at the smallest size this tool allows, 6,400 × 32 px (shortest side 32 px), and an encoder setting of 10%, the file was 7.10 KB (7,266 bytes). Choose a la [independent Chromium measurement: 7266 bytes; encodes 5]
  detailed200off: detailed.jpg -> 200565 bytes (limit 204800), 4000x3000, setting 15%
  detailed200on: detailed.jpg -> 196930 bytes (limit 204800), 1836x1377, setting 71%; full size at 70% = 1447846 bytes (over limit); 5% larger (1928x1446) at 70% = 211610 bytes (over limit)
  webp500on: photo.webp -> 503453 bytes (limit 512000), 1600x1200, setting 79%
  wide40on: wide-noise.png -> 40905 bytes (limit 40960), 6400x32, setting 45% (at smallest allowed size) | note: "The image was made smaller, to 53% of the original width (same shape), which is the smallest size this tool allows (32 px on the shortest side). Even at that size it did not fit at a setting of 70%, so the setting had to go down to 45%."
  strip20on: strip-noise.png -> 20142 bytes (limit 20480), 3000x30, setting 23%; full size at 70% = 51397 bytes (over limit)
  previews360: boxes 260x195 and 260x195 css px; Result: the downloaded JPEG itself, 1,836 × 1,377 px, 192.3 KB (196,930 bytes), setting 71%.
  previews1280: boxes 405x303 and 405x303 css px; Result: the downloaded JPEG itself, 1,836 × 1,377 px, 192.3 KB (196,930 bytes), setting 71%.
  pages: 7 pages, 7 unique internal links checked; origin https://phototools-test.example.com; owner "Test Owner & Co"; email owner@phototools-test.example.com
```

## Stage 2A background (algorithm and evidence, unchanged in 2A.1)

### Investigation and reproduction

In Stage 1.1.1, "Allow smaller dimensions" only took effect after the 10% encoder setting had failed at full size. So when a setting between 10% and 70% fitted at full size, the tool accepted it and never resized, even with the option on.

Reproduction on the unchanged Stage 1.1.1 code, with a detailed 4000×3000 JPEG of text over a textured background (`detailed.jpg`, 4,088,326 bytes) and a 200 KB limit with resizing ON: the result was **4000×3000 at a 15% setting** (200,565 bytes). At 1:1 pixel size it shows ringing around the text and smeared texture (`evidence/evidence-detailed_jpg-200kb.png`, middle column). A 3000×2000 photo-like fixture at 150 KB gave **3000×2000 at 16%** with visible JPEG block texture (`evidence/evidence-photo_jpg-150kb.png`).

### What changed

**Resizing ON:**
1. Try full size at 92%.
2. Then try full size at 70%. If that fits, raise the setting as far as it fits and keep the full size.
3. Otherwise shrink at 70%, grow back toward the largest size that fits (within 2%), then raise the setting.
4. Go below 70% only at the smallest allowed size (shortest side 32 px).

The image is never enlarged and the aspect ratio is kept.

**Resizing OFF:** the search is unchanged. The result now explains when the setting is below 70%. The label says "Encoder quality setting", and the text states it is not a measured visual-quality score.

**Result display:** the original and the result are shown at the same on-screen size, with captions giving each one's real pixels and bytes, and the user is asked to inspect faces and text. The original preview is now a lossless PNG of at most 1,600 px; it was 640 px before.

Unchanged: validation, cancellation, stale-result protection, reset, metadata removal, privacy and CSP, configuration tools.

Note: when I started this stage, the working copy contained unfinished, undelivered Stage 2A edits from an earlier interrupted session. I set them aside and rebuilt this stage from the delivered Stage 1.1.1 ZIP, so every change here was made and tested in this session.

### Before/after evidence

Command:
```
SITE_DIR=<Stage 1.1.1 site> OUT=/tmp/evidence LABEL=before node tests/quality-evidence.mjs
SITE_DIR=site               OUT=/tmp/evidence LABEL=after  node tests/quality-evidence.mjs
```

"screen" = both images scaled to 1000 px wide. "zoom" = both at the original's full pixel size. PSNR and SSIM are luma, against the original. Higher is closer to the original.

Before (Stage 1.1.1):
```
before-detailed_jpg-50kb-resize-on: 47610 bytes (limit 51200), 845x634, encoder setting 78%; screen PSNR 29.42 dB SSIM 0.9226; zoom PSNR 23.59 dB SSIM 0.5232
before-detailed_jpg-100kb-resize-on: 101636 bytes (limit 102400), 1369x1027, encoder setting 70%; screen PSNR 35.26 dB SSIM 0.9490; zoom PSNR 25.71 dB SSIM 0.5468
before-detailed_jpg-200kb-resize-on: 200565 bytes (limit 204800), 4000x3000, encoder setting 15%; screen PSNR 39.42 dB SSIM 0.9419; zoom PSNR 29.64 dB SSIM 0.5720
before-detailed_jpg-200kb-resize-off: 200565 bytes (limit 204800), 4000x3000, encoder setting 15%; screen PSNR 39.42 dB SSIM 0.9419; zoom PSNR 29.64 dB SSIM 0.5720
before-detailed_jpg-100kb-resize-off: NO RESULT: Could not get this image under 100 KB (102,400 bytes). No file was created.The smallest result was 158.9 KB (162,728 bytes) at 10% quality and the original 4,00
before-photo_jpg-50kb-resize-on: 48634 bytes (limit 51200), 707x471, encoder setting 78%; screen PSNR 35.23 dB SSIM 0.8624; zoom PSNR 26.16 dB SSIM 0.3262
before-photo_jpg-150kb-resize-on: 148791 bytes (limit 153600), 3000x2000, encoder setting 16%; screen PSNR 37.31 dB SSIM 0.8961; zoom PSNR 26.72 dB SSIM 0.4240
before-photo_jpg-150kb-resize-off: 148791 bytes (limit 153600), 3000x2000, encoder setting 16%; screen PSNR 37.31 dB SSIM 0.8961; zoom PSNR 26.72 dB SSIM 0.4240
```

After (Stage 2A):
```
after-detailed_jpg-50kb-resize-on: 48980 bytes (limit 51200), 945x708, encoder setting 71%; screen PSNR 30.23 dB SSIM 0.9256; zoom PSNR 23.95 dB SSIM 0.5254
after-detailed_jpg-100kb-resize-on: 101636 bytes (limit 102400), 1369x1027, encoder setting 70%; screen PSNR 35.26 dB SSIM 0.9490; zoom PSNR 25.71 dB SSIM 0.5468
after-detailed_jpg-200kb-resize-on: 196930 bytes (limit 204800), 1836x1377, encoder setting 71%; screen PSNR 36.26 dB SSIM 0.9613; zoom PSNR 27.02 dB SSIM 0.5660
after-detailed_jpg-200kb-resize-off: 200565 bytes (limit 204800), 4000x3000, encoder setting 15%; screen PSNR 39.42 dB SSIM 0.9419; zoom PSNR 29.64 dB SSIM 0.5720
after-detailed_jpg-100kb-resize-off: NO RESULT: Could not get this image under 100 KB (102,400 bytes). No file was created.The smallest result was 158.9 KB (162,728 bytes) at an encoder setting of 10% and the
after-photo_jpg-50kb-resize-on: 50088 bytes (limit 51200), 784x523, encoder setting 73%; screen PSNR 35.50 dB SSIM 0.8641; zoom PSNR 26.21 dB SSIM 0.3290
after-photo_jpg-150kb-resize-on: 151188 bytes (limit 153600), 1406x937, encoder setting 70%; screen PSNR 37.72 dB SSIM 0.9042; zoom PSNR 26.65 dB SSIM 0.3788
after-photo_jpg-150kb-resize-off: 148791 bytes (limit 153600), 3000x2000, encoder setting 16%; screen PSNR 37.31 dB SSIM 0.8961; zoom PSNR 26.72 dB SSIM 0.4240
```

What this shows, honestly:
- **Resizing OFF is unchanged:** the outputs are byte-identical (200,565 and 148,791 bytes), and 100 KB is still impossible with the same smallest result of 162,728 bytes.
- **Resizing ON, cases that changed (detailed 200 KB, photo 150 KB):**
  - **At screen size**, the Stage 2A results score higher on SSIM: 0.9613 vs 0.9419 for detailed, 0.9042 vs 0.8961 for the photo.
  - **PSNR at screen size is mixed:** lower for detailed (36.26 vs 39.42 dB), higher for the photo (37.72 vs 37.31 dB).
  - **At full zoom**, the Stage 2A results score lower on both measures. In the detailed image the small (18–22 px) text is clearly blurrier, while the Stage 1.1.1 result is sharper but has ringing.
- **Tradeoff:** Stage 2A trades JPEG blocking for softness. It cannot restore detail that a smaller picture has no pixels for. This is why the page now tells users with text-heavy images to try both settings and compare.
- **Resizing ON, 50 and 100 KB:** these already resized in Stage 1.1.1. They gave the same or slightly larger dimensions now (945×708 vs 845×634 at 50 KB) because the grow-back step is finer.
- PSNR and SSIM are simple measures on synthetic images. They are not evidence about the user's photo, and neither proves that text or faces are readable.

The composites in `evidence/` were assembled with Pillow from the screen and zoom images saved by `quality-evidence.mjs`; that step is not part of the ZIP. The mobile screenshots in `screenshots/` show the compressor before and after a successful 200 KB result with resizing on (detailed fixture).

## Not tested / limitations

- **The user's actual photo**, and real camera photos in general. All evidence uses synthetic fixtures.
- **Real Android phones**, plus Firefox, Safari, Samsung Internet and Edge. Other encoders give different sizes and settings; for example, ChatGPT's native encoder chose about 33% where Chromium chose 45%.
- **Human readability judgement** beyond my own inspection. PSNR and SSIM are not reading tests.
- **Full-resolution comparison:** there is no full-resolution original viewer, by design. The original preview is capped at 1,600 px, and the page now says so.
- The 40-attempt-budget message path, a real back/forward-cache navigation, Node.js 18, Windows paths, the real GitHub workflows and Cloudflare build gate, a real 40-megapixel image, screen readers and automated accessibility checkers.
