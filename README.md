# FIB Script Generator

A React + Vite tool that turns a Future Industry in a Box case's structured
data into a draft 7-beat comic script. Ten fields map directly onto the
7 beats; a Vercel serverless function (`/api/generate`) calls the Anthropic
API server-side to draft the script. Visually matches the real FIB
dashboard's own design system (fonts, colors, card and pill styling).

Full feature set:
- The 10-field form, with three worked examples (FIB-001, FIB-010, FIB-014)
- An editable **case page**: click any node or fact to edit it directly,
  text boxes auto-grow to fit their content
- A **Cast & scene list**: auto-derived speaking characters (from your
  Decision Maker / Risk Raiser fields) plus a 7-row scene breakdown —
  shot type, who's in each scene, a one-line summary
- Per character: **Copy character prompt** (a ready-to-paste description
  for any image generator) and **Generate reference image**, which calls
  Gemini directly and shows the result inline
- A **storyboard**: the 7 beats as comic-styled panels in a connected
  vertical sequence, each with a reference sketch (a dynamic branching
  flowchart for the decision beat, simple line-art icons for the rest),
  "Edit text" (hand edit), and "Redo this panel" (asks Claude to redraft
  just that one beat, leaving the other six untouched)
- A generated **learner preview**: a predict-then-reveal walkthrough built
  from the same fields, with no case-specific code

## Local development

```bash
npm install
cp .env.example .env   # then put your real keys in .env
npm install -g vercel  # if you don't have it
vercel dev              # runs the Vite frontend AND the /api functions together
```

`npm run dev` alone only runs the frontend — Generate and the image
buttons will fail with a 404 because the `/api` functions need Vercel's
dev server (or a deploy) to run.

## Deploy to Vercel

1. Get a free Gemini key from https://aistudio.google.com — it powers both the script and the images. (To use Claude instead, set `SCRIPT_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`; Anthropic needs billing set
   up.)
2. Push this folder to a GitHub repo (or skip GitHub and run `vercel` from
   inside this folder to deploy straight from your machine).
3. On vercel.com: **Add New → Project**, import the repo. Vercel
   auto-detects Vite; no build settings need to change.
4. Before the first deploy finishes, go to **Project Settings →
   Environment Variables** and add (Production, and Preview if you want
   preview deploys to work), marking each as **Sensitive**:
   - `APP_PASSWORD` — optional; if set, users must enter it to use the tool
   - `GEMINI_API_KEY` — script generation
   - `IMAGE_PROVIDER=cloudflare`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` — illustrations
   Never put keys in the code or commit `.env`.
5. Deploy. Vercel builds the frontend to `dist/` and automatically turns
   `api/generate.js` and `api/generate-image.js` into serverless
   functions at `/api/generate` and `/api/generate-image`.

### Before you rely on the image button

`api/generate-image.js` has a `MODEL` constant naming Gemini's
image-capable model. Documentation on the exact current model name was
inconsistent at the time this was written — check the current model list
at https://ai.google.dev (or Google AI Studio) before deploying, and
update that constant if it's changed.

## Embedding in another site (e.g. the FIB dashboard)

The tool is built on the dashboard's design tokens (colors, Space Grotesk / Inter, 14px cards, pill buttons)
and all of its CSS is scoped under a `.fib-tool` container, so it neither leaks styles into the page around
it nor picks up that page's global styles. Add `?embed=1` to make the background transparent.

```html
<iframe id="fib-tool" src="https://fib-script-tool.vercel.app/?embed=1"
        style="width:100%;border:0;min-height:700px" title="FIB script tool"></iframe>
<script>
  // optional: auto-resize the iframe to the tool's content
  addEventListener('message', (e) => {
    if (e.data && e.data.type === 'fib-tool-height') document.getElementById('fib-tool').style.height = e.data.height + 'px';
  });
</script>
```

To restyle it, override the tokens from the host page's CSS, e.g. `.fib-tool { --ink: #123; --disruption: #c33; }`
(only works when the tool's CSS is on the same page, not inside an iframe).

## Cost note

Every click of "Generate script," "Redo this panel," or "Generate
reference image" calls an external API using these keys and costs money.
There's no per-user login or rate limiting built in — anyone with the URL
can use every feature. Consider adding a simple shared password check,
or Vercel's password-protection feature, before sharing the link widely.
