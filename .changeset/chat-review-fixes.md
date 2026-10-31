---
"@olddevs/ui": patch
---

Keep ChatTranscript following unless the viewport actually moves up: a downward swipe, or upward input with no room to scroll, no longer pauses it, and neither does a popup trigger with `aria-haspopup`. ChatMessage no longer leaves an empty name slot for an empty `author`.
