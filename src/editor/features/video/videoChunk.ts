"use client";

/*
  Video chunk (ADR-0058, item 11.1): the node, its NodeView with the player, and the
  link field. The `youtube` and `twitch` Tool descriptions (`videoTools.ts`) hold only
  the Loader of this file and do not put the file itself into the start bundle, so a
  page without video does not pay for the player.
*/
export { createVideoNode } from "./video.js";
export { VideoForm } from "./VideoForm.js";
