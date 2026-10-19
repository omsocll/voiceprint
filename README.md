# Voiceprint

A browser-only AI writing tool that learns your voice. Paste 2–5 samples of your own writing, Voiceprint builds an editable "voice profile", then drafts new essays, posts or emails in your style. A second pass revises each draft specifically for voice, and you can compare versions side by side.

**Status:** not deployed yet.

## How it works

1. **Profile:** your samples are sent to Gemini once to produce a written style profile, which you can edit.
2. **Draft:** your brief plus the profile (not the samples) produce a first draft.
3. **Voice revision:** a second request revises that draft to sound more like you.

Other features: multiple named profiles, `.txt` upload, length/format/voice-strength controls, and regenerate.

## Privacy and your API key

You bring your own Gemini API key. It is stored only in your browser's localStorage and sent directly to Google in the `x-goog-api-key` header. There is no backend. Requests set `store: false`.

What that means in practice:

- **It's your own key.** Voiceprint never ships with a key; each user pastes their own. Nothing is sent to me or any server other than Google's Gemini API.
- **It's stored locally, in plain text.** localStorage is readable by anything running on the same origin and by anyone with access to your browser profile. Use it on your own device, and clear it (or remove the key in Settings / clear site data) on shared computers.
- **Limit the blast radius.** Create a dedicated key in Google AI Studio for this app, restrict it to the Gemini API, set a quota/budget, and delete it if you think it leaked.
- **Hardening:** the page sets a strict Content-Security-Policy (only its own scripts, network requests only to `generativelanguage.googleapis.com`) and renders model output with escaping, which reduces the chance of injected code reading the key.
- If you deploy this publicly, a server-side proxy holding the key would be safer than bring-your-own-key in the browser, but it would cost you API credits.

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
