# Decisions

## D-001 Editor choice (Phase 0 IME gate)
Status: decided (2026-10-28)
Result per item: items 1–10 passed with both input methods (macOS Telex and a third-party method), reported by the owner.
Not covered: tech spec §5.7 "`/` typed while composing" was not tested separately (checklist item 5 types `/` first, then composes the filter). Phase 2 must add the `view.composing` guard for the slash trigger or test this case in its checklist.
Decision: BlockNote 0.56
Why: the owner's Phase 0 checklist passed in full, so the tech spec's default editor stands.
