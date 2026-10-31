---
"@olddevs/ui": patch
---

Omit empty timestamp and actions wrappers in ChatMessage so empty strings and false do not leave metadata gaps or action spacing. Preserve numeric zero in both slots.
