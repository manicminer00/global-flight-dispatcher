# VECTOR Mission Copy — Writing Guide (draft v2)

This consolidates `VECTOR Mission Copy Style Guide v3.pdf` and
`MISSION_COPY_REWRITE_RULES.md` into one working reference, plus fixes the
title word-break bug and adds concrete anti-robotic guardrails. Where this
guide and the v3 PDF conflict, this guide wins for the rewrite pass — it's
the more recent decision.

## The core problem we're solving

Previous AI passes (ChatGPT, Cursor, Gemini) produced technically-compliant
but robotic, repetitive copy. This guide exists to fix *voice*, not just
constraints. A mission is a tiny story, not a logistics summary.

## Title rules (revised — fixes the wrap bug)

The wrap bug is NOT about total title length — it's individual words that
don't fit the ticket column at ticket font size, so the browser force-breaks
mid-word (no CSS fix in scope for this pass, per Toby's call).

- **Per-word length cap: 10.** Measured in-browser against the live
  `.contract-ticket-mission` CSS (Roboto 800, 39px, 276px box width) via
  `getBoundingClientRect`/`getComputedStyle`, tested against real
  mission-title vocabulary. 10 is the verified safe cap at this font size
  and box width — re-measure if either changes again.
  **Verified 2026-07-22** (Playwright, local server, content-box width
  276px, no padding): all tested 10-char words fit (worst case
  "Monumental" at 266.8px). At 11 chars results are inconsistent —
  "Restoration" fits (260.3px) but "Remembrance," "Metamorphic," and
  "Mountainous" all overflow (277.6–288.4px). So 10 stays the cap, it's
  the safe guaranteed boundary even though some individual 11-char words
  would technically fit — the point is a mechanical per-word count you
  can apply without measuring every word, not the tightest possible
  limit. An earlier audit (21 Jul 2026, see AUDIT.md §6 / PATCH_NOTES.md)
  measured this same rule at a smaller 33px and got a cap of 12; the font
  was later increased to 39px, which brought the safe cap back down to
  10. Both measurements are correct for the CSS that existed at the time.
- Aim for 3–5 words, ~24 characters total (down from the old ~28 guideline —
  giving headroom since the CSS itself isn't being fixed this pass).
- Every word individually checked against the verified cap before a title is
  considered done — this is a mechanical check, not a style judgment call.
- **This check applies even when keeping an old title unchanged (missed on
  imgId 155, "Restoration Delivery").** "Restoration" is 11 characters,
  over the cap, but it slipped through because the old title was left
  as-is and never re-counted. Old titles were written under the looser v3
  rule, not this one, so "I'm not changing it" is not a reason to skip the
  letter count. Count every word of every title going into `newTitle`,
  kept-as-is or not.
- Distinct per imgId. No reused titles across unrelated missions.
- Natural headline casing, title case.
- Humor welcome where it fits the mission (not forced everywhere).

## Voice — what "natural" actually means here

**Never use:** utilize, ensure, adhere (to), execute, be mindful of, in order
to, please note, at this time, you're tasked with, "safe travels," or any
line that could be pasted into a corporate memo unchanged.

**Watch for "stay/be + bare adjective" describing how someone flies
(caught on imgId 173).** "Hold a safe height... and stay predictable" is
bad English, no dispatcher talks like that. A real person ties the
adjective to a concrete noun instead: "keep your track predictable," "fly
a predictable pattern," "no sudden moves." This phrasing was carried over
verbatim from the *old* brief text, so preserving an existing instruction
detail doesn't mean the sentence it's embedded in is already
natural-sounding, check the actual English even when the underlying
detail is correct and unchanged.

**No em-dashes, ever.** Use a period, comma, or restructure the sentence
instead.

**Prefer a concrete, physical or actionable detail over an abstract term
(caught on imgId 216 and 219, final military batch).** imgId 216: "sharp
energy management" became "fight through the G's and try not to black
out" — a real sensation, not a training-manual phrase. imgId 219:
"expect a crowd watching your arrival" (passive scenery) became "watch
out for slow civilian flights" (something the pilot actually has to do).
When a line can be either an abstract description or a concrete
thing-the-pilot-notices-or-does, pick the concrete one.

**Don't sand down wit that's already there (caught during the survey-
category review, imgId 124).** The old copy for the civic leaflet mission
had a dry "Misinformation" title, a wink at the fact it's a government
messaging flight. My first draft played it neutral and dropped that edge
entirely. Toby's edit leaned into it harder instead, adding "don't let
anyone tell you this is propaganda, this is freedom of speech." If the
source material already implies a joke or an edge, the job is to sharpen
it, not quietly remove it out of caution. This is different from writing
new edgy jokes from scratch, it's about not flattening what was already
there.

**Every brief needs a story beat**, not just a task description. Concretely,
that means at least one of:
- A specific, small human detail (why *this* mission, why *now*)
- A stake, mood, or bit of texture beyond "fly point A to point B"
- A voice that sounds like one specific dispatcher on a specific day, not a
  template

Bad (robotic): "You have a full cabin of passengers. Fly safely to the
destination and maintain a smooth descent."

Better (has a beat): "The regional system's been down for hours and this
cabin's been waiting it out. Give them a clean sector and get them home."

## Tonal register — the dispatcher isn't always the same person

Brevity for clarity always matters, but the *register* of the dispatcher
shifts with the job, the same way a real ops room sounds different
depending on who's on the mic:

- **Local/regional runs** (short-haul, small-field, casual cargo): looser,
  conversational, almost neighborly. A supply hop feels like a favor between
  people who know each other.
- **Major-hub commercial** (the daily bread — scheduled pax, cargo trunk
  routes): crisp, professional, procedural — this is EGLL ground control
  energy, not chatty, but not cold either.
- **Medevac / urgent**: tighter sentences, higher stakes, no wasted words.
  Urgency should read in the rhythm of the sentence, not just the vocabulary.
- **Military (`*-MIL`)**: stiff, direct, imperative. Minimal warmth,
  maximum clarity. A dry humor beat is fine on top of this (confirmed on
  imgId 215, a Top Gun jab, and imgId 217, "smile for the cameras") — it's a
  beat, not a personality change. Keep the imperative spine, add one line of
  color, don't soften the whole thing.
- **VIP/celebrity**: a notch more discreet and personal — this passenger is
  used to being handled carefully.
- **Glider/warbird/heritage**: unhurried, textural — these missions can
  breathe a little more than a cargo run.

The point isn't a rigid lookup table — it's that the writer should ask "who
is this dispatcher, on this day, for this job?" before writing the line.

## Title vs. Brief Register

Titles and briefs serve different jobs and should not blur together.

**Titles** are functional dispatch-board headlines. A title states what the
job is and where it's going, nothing more:
  - Job type + context (e.g. "MEDICAL TRANSPORT", "CURRENCY FLIGHT")
  - Destination/route flavor is fine if it fits the cap (e.g. "COASTAL
    SURVEY", "BORDER RUN")
  - No mood, emotional state, or personality adjectives about the crew or
    passengers (reject "Half-Awake Meeting Rush", "Nervous First Flight",
    "Grumpy VIP Pickup" style titles)
  - No story beats in the title. If it needs a verb describing how someone
    feels or behaves, it belongs in the brief, not here.

**Briefs** are where personality, mood, and story beat live. This is the
one place color and characterization belong, following the tonal register
rules above.

Rule of thumb: if you could read the title over a radio to ground crew and
it would sound like a job label, it's right. If it sounds like the opening
line of a short story, it's a brief, not a title.

**Toby's call (confirmed live during the executive-category review):** a
headline/catchphrase-style title is fine even though it doesn't state the
job in plain terms ("Wheeler Dealer," "Wheels Up," "Transfer News"), as long
as it (a) clearly links back to the actual mission once you know what it
is, and (b) makes sense linguistically and logically. Don't drift into
vague or dreamy titles that need the brief to explain what they mean. This
loosens the "no personality/vibe" line above for the title itself; the
distinct-per-imgId and per-word-length-cap rules still apply unchanged.

**This isn't an executive-category-only exception.** Confirmed again in the
final batch: imgId 223 (reconnaissance-MIL) → "Eye In The Sky," imgId 225
(gliderOps) → "Practice Makes Perfect." Catchphrase titles are fair game in
any category, civilian or military, as long as the two conditions above
still hold.

## Opening variety (carried over from rewrite rules — still mandatory)

Do not default to "You have..." Rotate naturally across nearby missions:
`The [passengers/cargo/ground team]...`, `{name} needs...`, `ATC expects...`,
`We have reports of...`, `This is...`, `Launch from...` (glider), imperative
openings for military (`Hold...`, `Maintain...`, `Proceed...`).

## Voice by mission type (unchanged from v3 — still authoritative)

- Civilian: plain professional US English, aviation shorthand welcome.
- Military (`*-MIL`): sortie, vector, LZ, OPSEC, loiter fuel; imperatives.
- Helicopter: hover, torque, LZ, predictable track.
- Glider: soaring concepts, `{dep_field}`/`{dest_field}`.
- Easter eggs (57, 88, 112, 118, 123, 183, 204, 250): keep the specific
  humor/mystery, don't lose the ops detail.

## Location-agnostic / aircraft-agnostic language

VECTOR doesn't know the destination flavor or which aircraft the player
picked for this dispatch, so avoid:
- Place-flavor guesses: "by the coast," "over the mountains" — unless the
  route data actually guarantees it (glider `{dep_field}`/`{dest_field}` are
  fine since those are named).
- Aircraft-specific instructions: "fly the helicopter," "keep the twin
  smooth" — unless `allowedAircraft` scopes the mission to one type.

Time-of-day flavor IS allowed as a suggestion, not a mandate: "This one
starts at dawn" is fine even if the player flies it at 9pm — it's flavor,
not a rule.

**This applies to titles too, not just briefs (caught during the medical-
category review, imgId 71).** "Rural Pickup" was rejected as a title
because it asserts a scenic/geographic setting the route data doesn't
guarantee, the player could just as easily be flying Heathrow to
Amsterdam. The test: a title or brief can reference a concrete mechanical
fact the mission data actually locks in (an uncontrolled strip, a roadside
LZ, a named glider field), but not an inferred setting word like "Rural,"
"Coastal," "Highway," or "Mountain" unless that word is literally the
fixed subject of the mission itself (e.g. "Roadside Extraction" is fine
because the LZ being on a road is a fact of that specific mission, not a
guess about the wider route).

**Do not assume `allowedAircraft` scoping guarantees a location or
setting (caught the same review pass, imgId 95).** A mission restricted
to bush-capable aircraft does NOT mean the generated route is remote,
VECTOR's route generation is independent of the mission's flavor text and
the player has total freedom over departure and destination. "A place
with no road in" was wrongly treated as a locked-in fact because the
mission was aircraft-scoped, it wasn't, and got rewritten out. Aircraft
scoping only justifies referencing aircraft handling or type (per the
aircraft-agnostic rule above), never destination characteristics. When in
doubt about whether VECTOR's engine actually guarantees a detail, don't
assume, ask Toby before writing it into copy.

## CRT body limits (unchanged from v3)

- Max 18 lines × 28 characters after placeholder expansion (title is
  separate, not counted).
- 1–3 sentences for most missions; up to ~14 lines for richer briefs.
- Preserve every source instruction detail, placeholder, and named
  person/team/cargo exactly.

## Scope guardrails (unchanged from rewrite rules)

- Rewrite only `title` and `instruction` per imgId.
- Never touch `missions-db.js` payloads, routing, dispatch logic, or
  `mission-assignments-data.js`.
- `payload` is reference-only — never a writing template.

## Repeating a named placeholder isn't always required (corrected after
misreading imgId 139)

Dropping a second `{name}`/`{team}`/`{musician}` reference within the
same brief is fine, and often better, when the referent is already
unambiguous from an earlier sentence in that same brief. imgId 139's
brief opens with "{name}'s meeting their spiritual guru," then later says
"keep your client's name off any open channels" instead of repeating
`{name}` a second time. That's not a placeholder drop, it's how an actual
person talks, nobody says a proper noun twice in two sentences when "your
client" is unambiguous. This was flagged as a functional bug on first
pass and it wasn't, Toby corrected that read. The real check isn't "does
every placeholder from `oldBrief` reappear in `newBrief`," it's "would
the sentence still make sense and refer to the right person/thing without
that repeat." Don't restore a dropped repeat just because the count looks
off.