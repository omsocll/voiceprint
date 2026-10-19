/* Voiceprint is a static, browser-only app. Samples and profile never leave this page
   except when explicitly included in a direct request to Google's Gemini API. */
const MODEL = 'gemini-3.8-flash';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const STORE = { key: 'voiceprint.geminiKey', profile: 'voiceprint.profile', samples: 'voiceprint.samples', profiles: 'voiceprint.profiles', activeProfile: 'voiceprint.activeProfile', result: 'voiceprint.result', brief: 'voiceprint.brief', voiceStrength: 'voiceprint.voiceStrength' };
const $ = (selector) => document.querySelector(selector);
const samplesEl = $('#samples');
let profiles = loadJSON(STORE.profiles, null);
if (!Array.isArray(profiles) || !profiles.length) {
  profiles = [{ id: `voice-${Date.now()}`, name: 'My voice', profile: localStorage.getItem(STORE.profile) || '', samples: loadJSON(STORE.samples, [{ title: 'Sample 1', text: '' }]) }];
  localStorage.setItem(STORE.profiles, JSON.stringify(profiles));
}
let activeProfile = profiles.find(item => item.id === localStorage.getItem(STORE.activeProfile)) || profiles[0];
let samples = activeProfile.samples || [{ title: 'Sample 1', text: '' }];
let generatedText = localStorage.getItem(STORE.result) || '';
let requestBusy = false;
let lastGeneration = null;
let voiceStrength = localStorage.getItem(STORE.voiceStrength) || 'balanced';

function loadJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
function saveActiveProfile() {
  activeProfile.samples = samples;
  activeProfile.profile = $('#profile').value;
  localStorage.setItem(STORE.profiles, JSON.stringify(profiles));
  localStorage.setItem(STORE.activeProfile, activeProfile.id);
}
function saveSamples() { saveActiveProfile(); localStorage.setItem(STORE.samples, JSON.stringify(samples)); updateSampleCount(); }
function renderProfileOptions() {
  const select = $('#profile-select'); select.replaceChildren();
  profiles.forEach(item => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; select.append(option); });
  select.value = activeProfile.id;
}
function switchProfile(id) {
  saveActiveProfile();
  activeProfile = profiles.find(item => item.id === id) || profiles[0];
  samples = activeProfile.samples || [{ title: 'Sample 1', text: '' }];
  $('#profile').value = activeProfile.profile || '';
  renderProfileMarkdown($('#profile').value);
  $('#profile').classList.add('hidden'); $('#profile-preview').classList.remove('hidden');
  $('#save-profile').classList.add('hidden'); $('#edit-profile').classList.remove('hidden');
  $('#profile-state').textContent = activeProfile.profile
    ? (activeProfile.profileVersion >= 2 ? 'Saved in this browser' : 'Rebuild profile for improved voice capture')
    : 'No profile saved yet';
  localStorage.setItem(STORE.activeProfile, activeProfile.id);
  renderProfileOptions(); renderSamples();
  setStatus($('#analyze-status'), ''); setStatus($('#generate-status'), '');
}
function updateSampleCount() { $('#sample-count').textContent = `${samples.length} of 5 samples`; $('#add-sample').disabled = samples.length >= 5; }
function renderSamples() {
  samplesEl.replaceChildren();
  samples.forEach((sample, index) => {
    const block = document.createElement('div'); block.className = 'sample-block';
    const header = document.createElement('div'); header.className = 'sample-title';
    const label = document.createElement('label'); label.htmlFor = `sample-${index}`; label.textContent = sample.title || `Sample ${index + 1}`;
    const meta = document.createElement('small'); meta.textContent = `${(sample.text || '').trim().split(/\s+/).filter(Boolean).length} words`;
    header.append(label, meta);
    if (samples.length > 1) { const remove = document.createElement('button'); remove.className = 'remove-sample'; remove.type = 'button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${label.textContent}`); remove.addEventListener('click', () => { samples.splice(index, 1); saveSamples(); renderSamples(); }); header.append(remove); }
    const textarea = document.createElement('textarea'); textarea.id = `sample-${index}`; textarea.placeholder = 'Paste a piece of writing here…'; textarea.value = sample.text || ''; textarea.setAttribute('aria-label', label.textContent); textarea.addEventListener('input', () => { samples[index].text = textarea.value; meta.textContent = `${textarea.value.trim().split(/\s+/).filter(Boolean).length} words`; saveSamples(); });
    block.append(header, textarea); samplesEl.append(block);
  }); updateSampleCount();
}
function getKey() { return localStorage.getItem(STORE.key) || ''; }
function setStatus(element, message, error = false) { element.textContent = message; element.classList.toggle('error', error); }
function renderProfileMarkdown(markdown) {
  const preview = $('#profile-preview');
  const source = markdown.trim();
  preview.classList.toggle('empty-profile', !source);
  if (!source) { preview.textContent = 'Your voice profile will appear here after you add samples and build it…'; return; }
  const inline = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    .replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/__(.+?)__/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/_([^_]+)_/g, '<em>$1</em>');
  const lines = source.split(/\r?\n/); const html = []; let paragraph = []; let listType = '';
  const flushParagraph = () => { if (paragraph.length) { html.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph = []; } };
  const closeList = () => { if (listType) { html.push(`</${listType}>`); listType = ''; } };
  for (const line of lines) {
    const trimmed = line.trim();
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/); const bullet = trimmed.match(/^[-*+]\s+(.+)$/); const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (!trimmed) { flushParagraph(); closeList(); continue; }
    if (heading) { flushParagraph(); closeList(); const level = heading[1].length; html.push(`<h${level}>${inline(heading[2])}</h${level}>`); continue; }
    if (bullet || numbered) { flushParagraph(); const nextType = bullet ? 'ul' : 'ol'; if (listType !== nextType) { closeList(); html.push(`<${nextType}>`); listType = nextType; } html.push(`<li>${inline((bullet || numbered)[1])}</li>`); continue; }
    closeList(); paragraph.push(trimmed);
  }
  flushParagraph(); closeList(); preview.innerHTML = html.join('');
}
function responseText(data) {
  if (typeof data.output_text === 'string') return data.output_text.trim();
  // The REST API returns generated content in model_output steps (the SDK's
  // output_text convenience property is not included in raw REST responses).
  const modelSteps = (data.steps || []).filter(step => step.type === 'model_output');
  const stepText = modelSteps.flatMap(step => step.content || [])
    .filter(part => part.type === 'text' || typeof part.text === 'string')
    .map(part => part.text || '').join('').trim();
  if (stepText) return stepText;
  return (data.outputs || []).flatMap(output => output.content || []).map(part => part.text || '').join('').trim();
}
async function askGemini(prompt, temperature = 0.7) {
  const key = getKey(); if (!key) throw new Error('Add your Gemini API key in Settings first.');
  const response = await fetch(API_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    // store:false asks Gemini not to retain this interaction for later retrieval.
    body: JSON.stringify({ model: MODEL, input: prompt, store: false, generation_config: { temperature } })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Gemini request failed (${response.status}).`);
  const text = responseText(data); if (!text) throw new Error('Gemini returned an empty response. Try again.'); return text;
}
function validSamples() { return samples.map((s, i) => ({ ...s, title: s.title || `Sample ${i + 1}`, text: (s.text || '').trim() })).filter(s => s.text); }
function analysisPrompt(items) {
  return `You are an expert stylistic analyst. Build a detailed, operational voice profile from the samples so a writer could reproduce the author's habits on a completely different subject. The profile must describe style alone, never what the author talks about.

Analyze the whole set comparatively. Separate habits that recur across samples from one-off choices, and note any deliberate variation by piece. Be concrete rather than generic. Where feasible, estimate typical sentence length and range, paragraph length, and the mix of short, medium, and long sentences. Describe syntax, clause patterns, vocabulary register and specificity, first/second/third-person use, contraction habits, hedging or emphasis, punctuation frequency, paragraphing, transitions, rhetorical moves, openings, development, and endings. Explain how these choices work together to create the writer's rhythm. Describe opening and closing moves as flexible structural patterns, never as fixed templates.

Make the profile easy to apply: state a compact voice fingerprint, then actionable rules under the headings below. Give positive and negative instructions with enough detail to distinguish this writer from generic polished prose. Mark weakly supported observations as uncertain rather than presenting guesses as facts.

STRICT CONTENT SEPARATION: Do not include or repeat anything specific to the samples. This includes their topics, subject matter, examples, anecdotes, metaphors, analogies, facts, statistics, opinions, names, quotations, or distinctive phrases. Do not quote or paraphrase sample wording, even as evidence. If a detail is about what the writer says rather than how they express it, exclude it. If a phrase or example appears in the samples, do not preserve it as a preferred phrase; describe the underlying stylistic pattern in neutral, generic terms instead. Keep every profile field about form, diction, rhythm, rhetorical behavior, or tone only. Do not guess at traits that the samples do not support.

Use these headings: Voice fingerprint; Vocabulary and diction; Sentence length and rhythm; Tone and point of view; Formality; Openings and development; Argument and transitions; Endings; Punctuation and formatting; Recurrent style patterns; Distinctive quirks; Reproduce; Avoid. Return only the profile. Do not include an introduction, quotations, sample-specific material, or example phrases.

${items.map((s,i)=>`--- WRITING SAMPLE ${i+1}: ${s.title} ---\n${s.text}`).join('\n\n')}`;
}
$('#settings-toggle').addEventListener('click', () => { const panel = $('#settings'); const open = panel.classList.toggle('hidden') === false; $('#settings-toggle').setAttribute('aria-expanded', String(open)); if (open) $('#api-key').value = ''; });
$('#save-key').addEventListener('click', () => { const value = $('#api-key').value.trim(); if (!value) { setStatus($('#key-state'), 'Paste a key before saving.', true); return; } localStorage.setItem(STORE.key, value); $('#api-key').value = ''; setStatus($('#key-state'), 'Key saved in this browser.'); });
$('#add-sample').addEventListener('click', () => { if (samples.length < 5) { samples.push({ title: `Sample ${samples.length + 1}`, text: '' }); saveSamples(); renderSamples(); samplesEl.lastElementChild?.querySelector('textarea')?.focus(); } });
$('#file-input').addEventListener('change', async (event) => {
  const files = [...event.target.files].slice(0, 5 - samples.length);
  for (const file of files) { const text = await file.text(); if (text.trim()) { if (samples.length === 1 && !samples[0].text.trim()) samples[0] = { title: file.name.replace(/\.txt$/i, ''), text }; else samples.push({ title: file.name.replace(/\.txt$/i, ''), text }); } }
  saveSamples(); renderSamples(); event.target.value = '';
});
$('#analyze').addEventListener('click', async () => {
  const items = validSamples(); const status = $('#analyze-status');
  if (items.length < 2) { setStatus(status, 'Add at least two writing samples to build a profile.', true); return; }
  if (items.length > 5) { setStatus(status, 'Use no more than five writing samples.', true); return; }
  if (requestBusy) return; requestBusy = true; $('#analyze').disabled = true; setStatus(status, 'Reading your writing…');
  try { const result = await askGemini(analysisPrompt(items), 0.2); $('#profile').value = result; renderProfileMarkdown(result); localStorage.setItem(STORE.profile, result); activeProfile.profileVersion = 2; saveActiveProfile(); $('#profile-state').textContent = 'Saved just now'; setStatus(status, 'Your profile is ready. Edit it to make it more you.'); }
  catch (error) { setStatus(status, error.message, true); } finally { requestBusy = false; $('#analyze').disabled = false; }
});
$('#edit-profile').addEventListener('click', () => { $('#profile-preview').classList.add('hidden'); $('#profile').classList.remove('hidden'); $('#edit-profile').classList.add('hidden'); $('#save-profile').classList.remove('hidden'); $('#profile').focus(); });
$('#profile-select').addEventListener('change', event => switchProfile(event.target.value));
$('#new-profile').addEventListener('click', () => {
  saveActiveProfile();
  const name = window.prompt('Name this voice profile:', `Voice ${profiles.length + 1}`);
  if (!name || !name.trim()) return;
  const item = { id: `voice-${Date.now()}`, name: name.trim(), profile: '', samples: [{ title: 'Sample 1', text: '' }] };
  profiles.push(item);
  localStorage.setItem(STORE.profiles, JSON.stringify(profiles));
  switchProfile(item.id);
});
$('#save-profile').addEventListener('click', () => { const profile = $('#profile').value.trim(); if (!profile) { $('#profile-state').textContent = 'Write or generate a profile first'; return; } localStorage.setItem(STORE.profile, profile); saveActiveProfile(); renderProfileMarkdown(profile); $('#profile-state').textContent = 'Saved just now'; $('#profile').classList.add('hidden'); $('#profile-preview').classList.remove('hidden'); $('#save-profile').classList.add('hidden'); $('#edit-profile').classList.remove('hidden'); });
$('#brief').value = localStorage.getItem(STORE.brief) || '';
$('#brief').addEventListener('input', () => localStorage.setItem(STORE.brief, $('#brief').value));
function lengthTarget(length) {
  return ({ short: { min: 150, max: 250 }, medium: { min: 400, max: 600 }, long: { min: 800, max: 1000 } })[length] || { min: 400, max: 600 };
}
function strengthGuidance(strength) {
  return ({
    subtle: 'Loosely follow the voice profile, natural readable prose first.',
    balanced: 'Follow the voice profile closely while keeping the writing natural and readable.',
    full: 'Lean hard into every quirk in the profile, even at the cost of polish.'
  })[strength] || 'Follow the voice profile closely while keeping the writing natural and readable.';
}
function generationPrompt(request, previousDraft = '', adjust = false) {
  const target = lengthTarget(request.length);
  const variationRule = previousDraft ? `\n\nPREVIOUS GENERATED DRAFT (variation reference only; do not reuse its sentences):\n${previousDraft}\n\nMake this take clearly different in phrasing, paragraph structure, and development from the previous draft while keeping the same voice and satisfying the same brief.` : '';
  const lengthRule = adjust
    ? `Aim for ${target.min}–${target.max} words. This is a length adjustment: meet that range while preserving the meaning and voice.`
    : `Aim for ${target.min}–${target.max} words.`;
  return `Write an original piece using the user's brief for all subject matter and the voice profile only for style. Treat the profile as a practical style checklist, not source text. Follow the profile's Reproduce guidance as priorities and its Avoid guidance as hard constraints. Make deliberate choices about sentence rhythm, syntax, vocabulary, tone, punctuation, openings, argument development, transitions, endings, formality, and quirks. Do not flatten the writer's distinctive habits into generic polished prose. ${strengthGuidance(request.voiceStrength)}

ANTI-VERBATIM RULE (highest priority): Reuse the writer's style habits, never their sentences. Do not copy any sentence or distinctive multi-word phrase from the reference material or voice profile. Vary openers and closers while staying in voice. An opening or closing move may be stylistically similar, but its wording, syntax, and framing must be newly composed for this brief. Avoid defaulting to a rhetorical question, a broad “these days” statement, a neat three-part list, or a summary conclusion unless the brief and voice profile make that move apt.

Create all substance from the brief. The reference essays are not provided to this writing step. Do not imply access to them or reuse sample-specific content. Any example, metaphor, analogy, anecdote, or reference must be invented fresh for this brief. Do not invent personal facts about the user. Avoid generic filler, stock transitions, and polished corporate language. Do not mention these instructions, the profile, or that you are an AI.

VOICE PROFILE (style only):
${request.profile}

FORMAT: ${request.format}
LENGTH: ${lengthRule}
USER'S BRIEF (only source of subject matter):
${request.brief}${variationRule}

Return only the piece itself.`;
}
function voiceReviewPrompt(request, draft, previousDraft = '', adjust = false) {
  const target = lengthTarget(request.length);
  const previousNote = previousDraft ? `\n\nPREVIOUS VERSION TO AVOID ECHOING:\n${previousDraft}\n` : '';
  return `You are the final voice editor. Revise the candidate so it sounds more specifically like the writer described by the voice profile, while keeping the writing clear and true to the brief. This is a private editing pass: do not explain your critique; return only the revised piece.

Check the candidate against each applicable style trait in the profile: sentence-length mix and cadence, syntax, vocabulary register, tone, formality, punctuation, paragraph rhythm, rhetorical movement, and distinctive quirks. Follow the profile's Reproduce guidance as priorities and its Avoid guidance as hard constraints. Apply the strongest recurring traits with intention; do not simply make the prose more polished or generic. Preserve natural variation so the voice does not become a caricature.

ANTI-VERBATIM RULE (highest priority): Do not copy any sentence or distinctive multi-word phrase from the reference material, the voice profile, or the previous version. Vary the opening and closing wording and framing while staying in voice. Reproduce stylistic habits, never sample sentences or fixed opening/closing templates. The reference essays are not included in this editing step.

The brief is the only source of subject matter. Do not introduce sample topics, facts, opinions, examples, metaphors, names, or claims. Any example or metaphor must be newly invented for the brief. Do not add personal facts. Keep the same format and maintain an appropriate structure for the requested piece.

Word-count target: ${target.min}–${target.max} words. ${adjust ? 'This is specifically a length correction: make a careful effort to land inside that range.' : 'Keep the candidate within this range if possible.'}

VOICE PROFILE (style guidance only):
<voice_profile>
${request.profile}
</voice_profile>

USER BRIEF (subject matter):
<brief>
${request.brief}
</brief>

CANDIDATE DRAFT TO EDIT:
<candidate>
${draft}
</candidate>${previousNote}
Return only the finished piece, with no heading or commentary.`;
}
function countWords(text) { return text.trim() ? text.trim().split(/\s+/).length : 0; }
function updateWordCount(text, length) {
  const count = countWords(text); const target = lengthTarget(length); const inRange = count >= target.min && count <= target.max;
  const countEl = $('#word-count'); countEl.textContent = `${count} words · target ${target.min}–${target.max}`;
  countEl.classList.toggle('out-of-range', !inRange);
  $('#adjust-length').classList.toggle('hidden', inRange);
  $('#adjust-length').textContent = 'Adjust length';
}
function setVoiceStrength(value) {
  voiceStrength = value; localStorage.setItem(STORE.voiceStrength, value);
  document.querySelectorAll('[data-strength]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.strength === value)));
  if (lastGeneration) lastGeneration = { ...lastGeneration, voiceStrength: value };
}
document.querySelectorAll('[data-strength]').forEach(button => button.addEventListener('click', () => setVoiceStrength(button.dataset.strength)));
setVoiceStrength(voiceStrength);
$('#length').addEventListener('change', () => {
  if (generatedText) updateWordCount(generatedText, $('#length').value);
  if (lastGeneration) lastGeneration = { ...lastGeneration, length: $('#length').value };
});
$('#format').addEventListener('change', () => {
  if (lastGeneration) lastGeneration = { ...lastGeneration, format: $('#format').value };
});
function populateComparison(items, output, length) {
  const selector = $('#compare-sample'); selector.replaceChildren();
  items.forEach((sample, i) => { const option = document.createElement('option'); option.value = String(i); option.textContent = sample.title; selector.append(option); });
  function showOriginal() { const sample = items[Number(selector.value)] || items[0]; $('#original-title').textContent = sample.title; $('#original-content').textContent = sample.text; }
  selector.onchange = showOriginal; showOriginal(); $('#generated-content').textContent = output; updateWordCount(output, length); $('#comparison').classList.remove('hidden');
}
async function generateWriting(request, { variation = false, adjust = false } = {}) {
  const status = $('#generate-status');
  if (requestBusy) return;
  requestBusy = true;
  ['#generate', '#regenerate', '#adjust-length'].forEach(selector => { $(selector).disabled = true; });
  setStatus(status, adjust ? 'Adjusting to the selected length…' : variation ? 'Writing a fresh take…' : 'Finding your words…');
  try {
    const previousDraft = variation ? generatedText : '';
    const prompt = generationPrompt(request, previousDraft, adjust);
    const draft = await askGemini(prompt, 0.75);
    setStatus(status, 'Checking the voice and refreshing the phrasing…');
    let output = draft; let reviewWarning = '';
    try {
      output = await askGemini(voiceReviewPrompt(request, draft, previousDraft, adjust), 0.25);
    } catch (reviewError) {
      reviewWarning = ` Draft created, but the voice review could not finish: ${reviewError.message}`;
    }
    generatedText = output; lastGeneration = request; localStorage.setItem(STORE.result, output);
    const items = validSamples(); if (!items.length) items.push({ title: 'No sample available', text: 'Add a writing sample to compare your voice.' });
    populateComparison(items, output, request.length);
    $('#regenerate').disabled = false;
    setStatus(status, (adjust ? 'Length adjusted.' : 'Your draft is ready.') + reviewWarning);
    if (!variation && !adjust) $('#comparison').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { setStatus(status, error.message, true); }
  finally { requestBusy = false; $('#generate').disabled = false; $('#regenerate').disabled = !lastGeneration; $('#adjust-length').disabled = false; }
}
$('#generate').addEventListener('click', () => {
  const profile = $('#profile').value.trim(), brief = $('#brief').value.trim();
  if (!profile) { setStatus($('#generate-status'), 'Build or write a voice profile first.', true); return; }
  if (!brief) { setStatus($('#generate-status'), 'Add a topic or brief first.', true); return; }
  generateWriting({ profile, brief, format: $('#format').value, length: $('#length').value, voiceStrength });
});
$('#regenerate').addEventListener('click', () => { if (lastGeneration) generateWriting(lastGeneration, { variation: true }); });
$('#adjust-length').addEventListener('click', () => { if (lastGeneration) generateWriting(lastGeneration, { variation: true, adjust: true }); });
$('#copy-output').addEventListener('click', async () => { try { await navigator.clipboard.writeText(generatedText); $('#copy-output').textContent = 'Copied'; setTimeout(() => $('#copy-output').textContent = 'Copy', 1400); } catch { $('#copy-output').textContent = 'Select text to copy'; } });
$('#profile').value = activeProfile.profile || '';
renderProfileMarkdown($('#profile').value);
if ($('#profile').value) $('#profile-state').textContent = activeProfile.profileVersion >= 2 ? 'Saved in this browser' : 'Rebuild profile for improved voice capture';
renderProfileOptions();
renderSamples();
