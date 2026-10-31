# Voice and text conversation recipe

`Recipes/VoiceChat` presents one conversation with a voice panel beside the
composer. The consumer example is `.storybook/recipes/VoiceChatDemo.tsx`;
`VoicePanelPresentation.tsx` is its controlled presentation helper. Neither is
a public package export, voice SDK or media runtime.

## Run the scenarios

Playground starts with voice off. Start voice enters Preparing; Connection
ready supplies a simulated admission event, and Connection failed supplies an
error. Retry voice connection returns to preparation without clearing history.
The Connected story supplies the assistant name and a static visualizer from
outside. Muted and ConnectionError show the other initial states.

Show interim transcript creates one provisional voice message. Repeated partial
events update that temporary message. Finalize transcript reconciles it with a
single accepted user turn; it does not append a second copy of recognized speech.
Append voice answer supplies response text, and Finish voice answer completes
it. Simulate audio playback changes only the agent's presentation: text and
speech represent the same answer, so no additional message is created.

These are explicit fixtures. They request no microphone permission, capture no
audio, play no sound and make no model or voice connection. The visualizer is
consumer-provided content, not a measured audio level.

## Independent state and ownership

The panel receives connection state (`disconnected`, `connecting`, `ready`,
`error`), agent state (`idle`, `listening`, `processing`, `speaking`) and the
microphone setting separately. A muted microphone does not imply an ended
session or a silent agent. Text labels remain available without a visualizer.
The compact panel retains every status and mute/end controls; expansion adds
the consumer's visualizer and simulation explanation.

Mute prevents new simulated interim speech but does not remove received words,
end voice or stop an assistant's response. An already captured interim segment
can still finalize while muted. End voice stops an active voice answer, keeps
its partial text with the interrupted label, discards unfinished interim speech
and preserves accepted history and the current draft. A text response that
started independently of voice is not stopped merely by ending the panel.

The consumer owns reconciliation, identifiers, order and response policy.
Interim speech is removed and replaced by one canonical user message in the
same UI update. The recipe marks its accepted voice turns through an external
message updater; the kit does not know a transcription protocol.
Finalizing recognized speech preserves an independently edited, unsent text draft.

## Text during voice and continuation

The text field remains editable. While voice is ready, sending text explicitly
stops the current generation and then sends the new turn synchronously. The
received partial answer remains interrupted and the voice session stays ready.
This interruption policy is implemented in the recipe, not PromptInput or
ChatTranscript. Outside a ready voice session, text retains the ordinary
single-response sending gate.

After End voice, continue by text in the same history or start another voice
session. The example does not inspect farewell text and never ends voice based
on message wording. Real barge-in, reconnection, device handling and semantic
session completion belong to the external runtime.

## Composition and accessibility

The recipe reuses `useChatDemo` and `ChatDemoFrame`, with the controlled voice
panel supplied as composer content. The name and visualizer are props; all
panel actions are external callbacks. No voice-specific state is added to
UiProvider or the package's public component API.

Visible connection/agent/microphone labels describe the independent states.
A separate polite atomic voice status changes on those state transitions;
partial words do not update it. The conversation lifecycle has its own status
and does not announce each response token. Explicit Start/End and terminal
fixture actions return focus to the composer before a control disappears.
Mute and compact/expanded controls retain their own focus.

Stories, unit checks and `tests-visual/chat.voice.spec.ts` exercise the UI and
external callbacks, including keyboard and emulated touch. The static supplied
visualizer needs no animation. Browser/axe checks do not establish actual screen
reader speech, real OS IME behavior or device/media compatibility; those require
manual verification with the eventual consumer.
