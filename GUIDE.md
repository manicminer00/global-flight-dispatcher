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
- Aim for 3–5 words, ~24 characters total (down from the old ~28 guideline —
  giving headroom since the CSS itself isn't being fixed this pass).
- Every word individually checked against the verified cap before a title is
  considered done — this is a mechanical check, not a style judgment call.
- Distinct per imgId. No reused titles across unrelated missions.
- Natural headline casing, title case.
- Humor welcome where it fits the mission (not forced everywhere).

## Voice — what "natural" actually means here

**Never use:** utilize, ensure, adhere (to), execute, be mindful of, in order
to, please note, at this time, you're tasked with, "safe travels," or any
line that could be pasted into a corporate memo unchanged.

**No em-dashes, ever.** Use a period, comma, or restructure the sentence
instead.

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
  maximum clarity.
- **VIP/celebrity**: a notch more discreet and personal — this passenger is
  used to being handled carefully.
- **Glider/warbird/heritage**: unhurried, textural — these missions can
  breathe a little more than a cargo run.

The point isn't a rigid lookup table — it's that the writer should ask "who
is this dispatcher, on this day, for this job?" before writing the line.

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