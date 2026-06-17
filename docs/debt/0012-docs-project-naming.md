---
id: 0012
title: docs/03_arquitectura_tecnica.md references incorrect Firebase project names
severity: low
status: open
---

## What was done

`docs/03_arquitectura_tecnica.md` contains a folder structure example (line ~105)
referencing `.firebaserc — Projects: salvador-dev and salvador-prod`. These names
are incorrect: the actual Firebase projects are `summer-chatbot-dev` and
`summer-chatbot-prod`.

The `.firebaserc` file was corrected as part of the Latency Lab sprint
(updated from `salvador-dev`/`salvador-prod` with `development`/`production` aliases
to `summer-chatbot-dev`/`summer-chatbot-prod` with `dev`/`prod` aliases).

## Why

The architecture document was written before the Firebase project names were finalized.
The document was deliberately not edited during the Latency Lab sprint to keep the
diff focused on the lab feature — a naming-only doc update doesn't belong in a
feature sprint.

## What should be done

Edit `docs/03_arquitectura_tecnica.md` line ~105 to replace:
```
.firebaserc — Projects: salvador-dev and salvador-prod
```
with:
```
.firebaserc — Projects: summer-chatbot-dev and summer-chatbot-prod
```

Search for any other occurrences of `salvador-dev` or `salvador-prod` in the file
and correct them. Do NOT edit the technical content — naming fix only.

## Estimated effort

15 minutes.

## Context

"Salvador" remains the display name of the Mentor mode character in the UI.
The package namespace `@salvador/shared`, `@salvador/functions`, `@salvador/web`
is intentionally kept — these are internal technical identifiers, not Firebase project names.
Only the Firebase project names (`summer-chatbot-*`) and Firestore collection prefixes
should reflect the project branding.
