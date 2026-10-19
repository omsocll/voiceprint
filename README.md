# Voiceprint

A browser-only AI writing tool that learns your voice. Paste 2–5 samples of your own writing, Voiceprint builds an editable "voice profile", then drafts new essays, posts or emails in your style. A second pass revises each draft specifically for voice, and you can compare versions side by side.

**Status:** not deployed yet.

## How it works

1. **Profile:** your samples are sent to Gemini once to produce a written style profile, which you can edit.
2. **Draft:** your brief plus the profile (not the samples) produce a first draft.
3. **Voice revision:** a second request revises that draft to sound more like you.

Other features: multiple named profiles, `.txt` upload, length/format/voice-strength controls, and regenerate.

## Privacy

You bring your own Gemini API key. It is stored only in your browser's localStorage and sent directly to Google in the `x-goog-api-key` header. There is no backend. Requests set `store: false`.

## Tech stack

Vanilla JavaScript, HTML and CSS, calling the Google Gemini API from the browser. No build step.

## Run it

Open `index.html` in a browser, or serve this folder locally:

```sh
cd voiceprint
python3 -m http.server 8000
```

Then open <http://localhost:8000> and add a Gemini API key under **Settings**. The app stores that key, your samples, profile, and draft in the browser's localStorage. When you build a profile or generate a piece, the page sends only the relevant text and key directly to Google's Gemini API. The key is sent in the `x-goog-api-key` request header and is never logged by the app.

Requests use the Gemini Interactions API with `gemini-3.8-flash`. They set `store: false` so Google does not retain the interaction for later retrieval. The model and endpoint are selected near the top of `app.js`.

Building a profile sends the samples in one request. Writing sends the brief and style profile for a first draft, then makes a second request with that draft for a voice-focused revision. Regeneration may also include the previous generated draft to avoid repeating its wording. Sample essays are never included in either writing request.

Use **New profile** in the profile card to create another named voice profile. Each profile keeps its own samples and profile text in localStorage.
