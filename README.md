# FIB Script Generator

Live: https://fib-script-tool.vercel.app/

I built this for the Future Industry in a Box (FIB) research team. Only 7 of the
21 FIB cases have a comic so far, and writing one by hand takes a long time. This
tool takes a case's 10 research fields and drafts the comic for you: a 7-beat
script, a storyboard, flowcharts, a cast list, and a library to save your work.

It is a draft maker, not a finished product. The team still reads and edits
everything it produces.

## What it does

- **Form and script side by side.** Fill in (or load) the 10 fields on the left,
  and the 7-beat script shows on the right. If you change a field after
  generating, the script is marked "out of date" so you know to regenerate.
- **Three worked examples** you can load with one click: FIB-001, FIB-010 and FIB-014.
- **Case page.** Click any node or fact to edit it directly.
- **Cast and scene list.** The characters (taken from the Decision Maker and Risk
  Raiser fields) and a 7-row breakdown of each scene. Each character has a
  copyable image prompt and a "Generate reference image" button.
- **Storyboard.** The 7 beats as comic panels, each with a picture. You can edit
  a panel's text by hand or redo just that one panel. Dialogue and captions are
  drawn onto the generated pictures (there is a switch to turn this off).
- **Saved library.** Stories are saved in your own browser, and you can export
  them as a ZIP.
- **Learner preview.** Built, but switched off for now (`SHOW_LEARNER_PREVIEW`
  in `src/App.jsx`). Set it to `true` to bring it back.

The script is checked after it is generated: it has to have 7 beats and it must
not invent numbers that are not in the fields. If a check fails, the tool retries.

## Run it locally

```bash
npm install
cp .env.example .env   # then put your own keys in .env
npm run dev            # frontend only
```

To run the `/api` functions as well, use the Vercel dev server:

```bash
npm install -g vercel
vercel dev
```

Without that, the Generate and image buttons will not work, because the API
functions need Vercel (or a deploy) to run.

## Keys (never commit `.env`)

| Variable | What it is for |
| --- | --- |
| `GEMINI_API_KEY` | Script generation. Free key from https://aistudio.google.com |
| `IMAGE_PROVIDER=cloudflare` | Use Cloudflare Workers AI for pictures |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Cloudflare credentials |
| `APP_PASSWORD` | Optional. If set, people need it to use the tool. Off by default |
| `SCRIPT_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` | Optional. Use Claude for the script instead of Gemini |

## Deploy

It deploys to Vercel from the `main` branch on GitHub. Vercel detects Vite on its
own. Add the variables above under Project Settings → Environment Variables
(mark them Sensitive), then deploy. `api/generate.js` and `api/generate-image.js`
become serverless functions automatically.

## Embedding in another site

The styling follows the FIB dashboard's look (fonts, colors, rounded cards), and
all the CSS sits under a `.fib-tool` class so it does not leak into the page around it.
Add `?embed=1` for a transparent background.

```html
<iframe id="fib-tool" src="https://fib-script-tool.vercel.app/?embed=1"
        style="width:100%;border:0;min-height:700px" title="FIB script tool"></iframe>
<script>
  // optional: resize the iframe to fit the tool
  addEventListener('message', (e) => {
    if (e.data && e.data.type === 'fib-tool-height') document.getElementById('fib-tool').style.height = e.data.height + 'px';
  });
</script>
```

To change colors, override the tokens, e.g. `.fib-tool { --ink: #123; --disruption: #c33; }`
(this only works when the CSS is on the same page, not inside an iframe).

## Cost

Every "Generate script", "Redo this panel" and "Generate reference image" click
calls an outside API with my keys. The image service has a limited free allowance.
There is no rate limit and no login, so anyone with the link can use it. If the
link gets shared widely, set `APP_PASSWORD`.
