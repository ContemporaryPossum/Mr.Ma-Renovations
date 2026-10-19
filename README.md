# Mr.MA Renovation website

A static, single-page site for Mr.MA Renovation (Setia Alam, Shah Alam). No build step: upload the files and it runs.

## Files (all in the repo root, no folders)

| File | What it does |
| --- | --- |
| `index.html` | All page content, SEO tags and LocalBusiness structured data |
| `styles.css` | Design tokens, layout, responsive rules |
| `main.js` | Lenis smooth scroll, GSAP ScrollTrigger scenes, form, open/closed status |
| `scene.js` | The scroll-driven vector background (Three.js line drawing that morphs house > exploded view > office plan > wave grid) |
| `charts.js` | Bklit-style ring and bar charts for the review data |
| `favicon.svg` | Browser tab icon |
| `_headers` | Cloudflare Pages security and cache headers |
| `robots.txt` | Lets search engines crawl the site |

Libraries load from jsDelivr at pinned versions (GSAP 3.14.2, Lenis 1.3.26, Three.js 0.169.0, Phosphor Icons 2.1.1). Fonts are Archivo and Geist Mono from Google Fonts.

## Deploy

1. **GitHub:** create a new repository, click **Add file > Upload files**, drag in every file above (including `_headers`), then commit.
2. **Cloudflare:** Workers & Pages > Create > Pages > **Connect to Git** > pick the repository.
   - Framework preset: **None**
   - Build command: leave empty
   - Build output directory: leave empty (the repo root is served as-is)
3. Save and deploy. Add the client's domain under **Custom domains** afterwards.

To preview on your own computer, open the folder with a local server (for example VS Code's Live Server, or `npx serve`). Opening `index.html` by double-clicking will not run the scripts, because browsers block JavaScript modules on `file://`.

## Before going live

**Swap in the client's own photos.** The photos are free Unsplash stand-ins (Unsplash License, commercial use allowed). Upload real job photos to the repo root and replace each URL in `index.html`:

| Where | Current stand-in |
| --- | --- |
| Services hover preview, 7 rows (`data-img` on each `<li class="svc">`) | roof workers, tile cutting, framing, painter, roof tiles, office corridor, drill |
| "The work, up close" cards (6 `<img>` tags) | bathroom, roof tiles, plaster, brick wall, office, mitre saw |
| Reviews bento photo cell | bathroom |

Portrait 4:5 images around 1100 x 1375 px work best for the work cards. Their Google Maps listing has more than 6,000 job photos to choose from.

**Confirm with the client:**
- The seven services and their one-line descriptions (based on their reviews, photos and Google category).
- Permission to quote the Google review by Silvarajan (the review is public, but asking is good practice).
- The numbers in the reviews section (4.9 stars, 32 reviews, 29 five-star, 6,157 photos, 6.7K TikTok followers, 35.8K likes) were taken from Google Maps and TikTok in October 2026. Update them in `index.html` and the `RATINGS` / `TOPICS` arrays at the top of `main.js` when they change.
- Whether they want their mascot logo in the nav instead of the house mark.

## Editing

- **Phone / WhatsApp number:** search `601160619060` and `011-6061 9060` in `index.html` and `main.js`.
- **Opening hours:** text in `index.html`; the live "Open now" logic is `initOpenStatus()` in `main.js` (Malaysia time).
- **Accent colour:** `--accent` in `styles.css`.
- **Background scene per section:** the `SCENE_KEYS` table at the top of `main.js` (camera angle, distance, which drawing is shown, brightness).

## Accessibility and fallbacks

- Respects `prefers-reduced-motion`: no smooth scroll, no pinned or scrubbed motion, static background, charts drawn in their final state.
- If WebGL is unavailable, a soft gradient replaces the vector scene. If the CDN scripts fail, the page still shows all content and the loader removes itself after 6 seconds.
- Each chart has a "View as table" option and keyboard-focusable bars.
