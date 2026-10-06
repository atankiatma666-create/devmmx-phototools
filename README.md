# devMmX PhotoTools — Stage 1.1 (with fixes 1.1.1)

A small static website with one tool: **Compress Image to a Target KB**.
Images are processed in the visitor's browser. Nothing is uploaded.
No backend, database, login, build step, ads or analytics.

## What is in this folder

```
site/                         ← the website. This is the ONLY folder Cloudflare publishes.
  index.html                  Home
  compress-image-to-kb/       The compressor page
  guides/reduce-photo-size-android/
  guides/image-dimensions-vs-file-size/
  about/  contact/  privacy/
  404.html                    Shown by Cloudflare Pages for unknown addresses
  assets/css/style.css        All styles
  assets/js/compressor.js     All tool logic (limits are at the top of the file)
  assets/img/favicon.svg
  robots.txt  sitemap.xml     Templates (domain placeholder)
  _headers                    Extra security headers for Cloudflare Pages
tools/config.mjs              Sets your domain, name and email; checks the site before publishing
tests/generate-fixtures.mjs   Makes the test images
tests/config-tests.mjs        Configuration tests (Node.js only)
tests/run-tests.mjs           Browser tests (Playwright + Chromium)
tests/run-all.mjs             Runs everything: config tests + browser tests on a template copy and a configured copy
.github/workflows/            Optional helpers that run on GitHub (see below)
site.config.example.json      Example of the saved settings file
TEST-RESULTS.md               What was tested and what happened
screenshots/                  Mobile compressor before and after a result (from the test run)
```

## Your details (configuration)

Three settings are used on the site. Each can be set, changed or corrected at any time, in any order.

| Setting | Example | Where it appears |
|---|---|---|
| Domain | `phototools.example.com`, or `yourproject.pages.dev` for the free Cloudflare address | Canonical link on all 7 pages, `sitemap.xml`, `robots.txt` |
| Owner name | `Your Name` or a business name | About and Contact pages |
| Contact email | `you@example.com` | Contact and Privacy pages |

How it works: each place that shows a setting is marked in the HTML (`data-config="canonical"`, `data-config="owner-name"`, `data-config="email"`, `data-config="email-link"`). The settings are saved in `site.config.json`, in the repository root and not published. Every run rewrites the marked fields from the saved settings, so old values are always fully replaced. `sitemap.xml` and `robots.txt` are generated from the canonical links. Before any run that changes settings, all three are checked. If one is invalid, nothing is changed. Values are escaped for HTML and XML and inserted exactly as typed.

Marked fields are checked page by page. The About page must have exactly one owner-name field. Contact must have one owner-name, one email and one email-link field. Privacy must have one email and one email-link field. No other page may have any. Each of the 7 pages needs exactly one canonical link. If a field is missing, duplicated, malformed or on an unexpected page, `status` and `prepublish` fail and name the page, and `set` and `apply` refuse to write anything. If you edit those pages, keep the `data-config` attributes exactly as they are.

Until a setting is given, the pages show a placeholder: `YOUR-DOMAIN.example`, `OWNER-NAME-PLACEHOLDER` or `CONTACT-EMAIL-PLACEHOLDER`.

Commands (the GitHub workflow below runs these for you):

```
node tools/config.mjs set --domain phototools.example.com --name "Your Name" --email you@example.com
node tools/config.mjs set --domain new-domain.example.com     # change just one setting later
node tools/config.mjs apply        # write saved settings into the site again (after updating files)
node tools/config.mjs status       # what is set; fails only if the pages don't match the saved settings
node tools/config.mjs prepublish   # fails unless all three are set, every page matches, and no placeholder remains
```

`status` passing means the files are consistent. It does not mean ready to publish. Only `prepublish` decides that. Cloudflare runs `prepublish` before every deployment (see Part 2), so a site with missing or mismatched settings is never published.

## Deploy from an Android phone

Use Chrome on your phone. Some GitHub and Cloudflare pages are easier with **Chrome menu → Desktop site** turned on. These steps were written carefully but could not be tested on a real phone or real accounts from the build environment; button names on those websites can change.

### Part 1 — Put the files on GitHub

A phone browser cannot upload folders to GitHub, so you upload the ZIP once and a small GitHub workflow unpacks it.

1. Sign in at github.com. Tap **+ → New repository**. Name it `devmmx-phototools`. Choose Private or Public. Tick **Add a README file** (so the repository is not empty). Tap **Create repository**.
2. In the repository, tap **Add file → Create new file**. In the name box type exactly:
   `.github/workflows/setup-site.yml`
   Open `.github/workflows/setup-site.yml` from this ZIP in a text viewer on your phone, copy all of it, and paste it into the big box. Tap **Commit changes**.
   (GitHub does not allow a workflow to create workflow files, so this one file must be pasted by you.)
3. Tap **Add file → Upload files**, choose `devmmx-phototools.zip` (the ZIP itself, not extracted), and tap **Commit changes**.
4. Open the **Actions** tab. If asked, enable workflows. Tap **Set up site → Run workflow**. Fill in your domain, name and email. Tap **Run workflow**.
   - Domain: only the name, like `phototools.example.com`. If you paste `https://` or a trailing `/` they are removed. Anything with a path or port is rejected.
   - You can fill in some boxes now and the others later. Blank boxes keep the saved value.
   - If a value is not valid, the run fails with a red cross, and its log says which value and why. Nothing is changed. Run it again with the corrected value.
5. Wait for the green tick. Open the **Code** tab. You should see `site/`, `tools/`, `tests/`, and a new `site.config.json`. The ZIP is gone. The run's log ends with either "Ready to publish" or a warning that lists what is still missing.

If you already pasted the Stage 1 version of `setup-site.yml`, replace it with the new one: open the file on GitHub, tap the pencil icon, select all, paste the new contents, and commit.

Your GitHub README will be replaced by this README. That is expected.

### Part 2 — Publish with Cloudflare Pages

1. Sign in at dash.cloudflare.com. Go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Connect your GitHub account and choose the `devmmx-phototools` repository.
3. Build settings:
   - Framework preset: **None**
   - Build command: `node tools/config.mjs prepublish`
   - Build output directory: `site`
4. Tap **Save and Deploy**. When it finishes you get an address like `devmmx-phototools.pages.dev`.
5. Every time the GitHub repository changes, Cloudflare runs the build command, then publishes. If a setting is missing or a page does not match `site.config.json`, the build fails and the previous version stays online. The build log shows the reason.

The build command is a check only. It does not change files, and it needs nothing installed beyond the Node.js that Cloudflare already provides.

Chicken-and-egg note: you may not know your `pages.dev` address until the first deploy. Either pick the project name first (the address is usually `<project-name>.pages.dev`) and run **Set up site** with it before connecting Cloudflare, or let the first build fail, then run **Set up site** with the address Cloudflare shows. The next build will pass.

### Part 3 — Use your own domain (optional)

1. In the Cloudflare Pages project, open **Custom domains → Set up a custom domain** and follow the steps.
2. Run **Set up site** again on GitHub, filling in only the **domain** box with the new domain. All canonical links, the sitemap and robots.txt switch from the `pages.dev` address to the new one.
3. Check that `https://your-domain/sitemap.xml` shows your domain.

If you keep the free address, use `yourproject.pages.dev` as the domain in **Set up site**.

### Updating later

When you get a new version as a ZIP, upload it with **Add file → Upload files**, then run **Set up site** with the boxes left blank. The workflow replaces `site/`, `tools/` and `tests/` with the new version, keeps `site.config.json`, and writes your saved details into the new files.

If a new version changes a file in `.github/workflows/`, that file must be updated by pasting, as in Part 1 step 2.

### On a computer instead

```
node tools/config.mjs set --domain phototools.example.com --name "Your Name" --email you@example.com
node tools/config.mjs prepublish
```
Then commit and push, including `site.config.json`. Cloudflare settings are the same as Part 2.

## Security policy and Stage 2 (ads)

Every page has a Content Security Policy in a `<meta http-equiv="Content-Security-Policy">` tag. It allows only this site's own scripts and styles, allows `blob:` and `data:` images for previews, and sets `connect-src 'none'`, so the pages cannot send data anywhere. The tests confirm that `fetch()` is blocked.

Stage 1 has **no** advertising, analytics, cookies or `ads.txt`. Adding an ad network in a later stage will need, at the same time:
- the ad network's real publisher ID in a new `ads.txt` (never a made-up one);
- changes to the Content Security Policy on each page, because ad scripts load from other domains;
- an updated privacy page that names the ad network, cookies and data use;
- a consent banner or consent management platform where the law or the ad network requires it (for example for visitors in the EEA/UK).

No earnings, search rankings or ad network approvals are promised by this project. Adsterra approval is not a requirement for AdSense, or the other way round.

## Tests

Tests need a computer with Node.js 20+ (Playwright does not run on Android). From the project folder:

```
npm install
npx playwright install chromium
node tests/generate-fixtures.mjs
node tests/run-all.mjs
```

`run-all.mjs` runs, in order:
1. `tests/config-tests.mjs`: 29 configuration scenarios on temporary copies (Node.js only).
2. `tests/run-tests.mjs` on a template copy, built in a temporary folder by `tests/template.mjs`. It resets every marked field to its placeholder and regenerates the sitemap and robots.txt. So the template is genuine even if your repository is already configured.
3. `tests/run-tests.mjs` on a configured copy: that template plus test settings, after a passing `prepublish`. Here the canonical links, sitemap, owner name and email are checked against those settings.
4. A check that your own `site/` and `site.config.json` are byte-for-byte unchanged.

The tests never modify your working site or saved settings, so they are safe to run after you have configured the site.

Results: `tests/results/config-report.txt`, `tests/results/template/report.txt` and `tests/results/configured/report.txt`. Each browser folder also has screenshots and the downloaded JPEGs. You can also test your own configured site with `SITE_DIR=site node tests/run-tests.mjs`.

Without a computer: copy `.github/workflows/tests.yml` into GitHub the same way as Part 1 step 2, then run **Run tests** from the Actions tab. The reports are attached to the run as `test-results`.

See `TEST-RESULTS.md` for the results of the runs made while building this version.

## How the compressor works

1. Checks the file size (max 25 MB). Reads the file header to detect the real format and dimensions before decoding: JPEG, PNG or WebP, judged by content, not by the file name. Refuses images over 40 megapixels or 12,000 px on a side. Detects incomplete JPEG, PNG and WebP files.
2. Decodes the image with the browser and makes a small preview, which is also used to detect transparency.
3. Draws the image on a white canvas, so transparent pixels become white, and encodes JPEG at 92% quality. If that fits, it stops.
4. Otherwise it encodes at 10%. If that fits, it binary-searches between 10% and 92% for the highest quality that fits.
5. If 10% is still too big and you allowed smaller dimensions, it shrinks the image and keeps the aspect ratio. The shortest side never goes below 32 px.
   - It aims for about 70% quality, estimating each new size from the last measured size.
   - If an estimate falls below the smallest allowed size, it measures the smallest allowed size itself instead of giving up: first at 70%, then at 10%.
   - When something fits, it grows back toward the largest size that still fits, then raises the quality where possible.
   - If even the smallest allowed size at 70% is too big but 10% fits, it keeps the smallest size and finds the highest quality that fits there. The result shows a low-quality warning.
6. Never more than 40 encodes per run. There are three honest outcomes when nothing fits:
   - "Lowering the quality alone was not enough" (resizing was off).
   - "Even at the smallest size this tool allows … the file was N bytes". This is a measured result.
   - "Stopped after its limit of 40 attempts … This does not prove it is impossible".
7. The final size is the real `Blob.size`. A result over the limit is never shown as success, and no download is offered.
8. While compressing, the size choices, custom limit and resize option are locked. Choosing another photo and **Start over** still work and cancel the run. If an option changes anyway (for example by a browser extension), the run is cancelled. A finished result is also discarded if the options no longer match the ones it was made for.
9. Leaving the page cancels any run and frees memory. If the browser restores the page from its back/forward cache, the tool comes back empty and fully usable.

## Known limitations

- Tested only in Chromium 141 (headless, Linux) at 360 px and 1280 px widths. Not tested on a real Android phone, Firefox, Safari or Samsung Internet.
- When resizing, the search prefers a smaller image at about 70% quality over a larger image at very low quality. The size it picks is the best it found within the attempt limit, not a proven optimum.
- Limits: 25 MB, 40 megapixels, 12,000 px longest side. Photos from 50+ megapixel camera modes are refused.
- Output is always JPEG. Metadata (EXIF, GPS) is not kept. Animated images become one frame.
- HEIC, AVIF, GIF and BMP are not accepted.
- The site does not work when opened directly from files on your phone (`file://`). It must be served, as Cloudflare Pages does.
- No guarantee a given form will accept the result; forms have their own rules.

## Pre-publication checklist

- [ ] Ran **Set up site** with the real domain, owner name and contact email. Its log says "Ready to publish". (On a computer: `node tools/config.mjs prepublish`.)
- [ ] Cloudflare build command is `node tools/config.mjs prepublish` and output directory is `site`.
- [ ] Opened every page on your phone: Home, Compressor, both guides, About, Contact, Privacy, and a made-up address to see the 404 page.
- [ ] Compressed one of your own photos at 50 KB and 20 KB, downloaded the result, and checked its size in your file manager.
- [ ] The contact email works (send yourself a test email).
- [ ] Read the About and Privacy pages and confirmed every statement is true for you (hosting on Cloudflare Pages, no ads, no analytics).
- [ ] Changed the "Last updated" date on the Privacy page if you edited it.
- [ ] `https://your-domain/sitemap.xml` and `/robots.txt` show your real domain.
- [ ] Read both guides once yourself, and changed anything you would explain differently.
