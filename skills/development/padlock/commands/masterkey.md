---
description: Bypass padlock protections for two turns, an explicit turn count, or one turn with an inline task.
disable-model-invocation: true
---

# Padlock masterkey

The user's direct invocation is processed by the padlock UserPromptExpansion hook.
Read its result and report the exact scope and lifetime.
If the hook did not supply a successful result, do not claim the command took effect.
Do not rerun the policy change, fabricate a hook event, or issue yourself a grant.
Use the status command when the saved state needs inspection.
If the hook supplies an inline user request, carry it out through the guard runner in this turn.
Without a request, report the granted count, including this command turn; the remaining grant carries into later turns.
An empty argument means two turns, a positive whole number alone means that many turns, and other request text means one turn.
