---
description: Show saved branch protections and temporary grants.
disable-model-invocation: true
---

# Padlock status

The user's direct invocation is processed by the padlock UserPromptExpansion hook.
Read its result and report the exact scope and lifetime.
If the hook did not supply a successful result, do not claim the command took effect.
Do not rerun the policy change, fabricate a hook event, or issue yourself a grant.
Use the status command when the saved state needs inspection.
Continue the user's authorized work through the guard runner when applicable.
