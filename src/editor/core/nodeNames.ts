/**
 * Names of Schema nodes that the engine is not the only one to know. A module without Tiptap: the name is
 * also needed by the Table of contents (`features/toc`), which does not need the engine in
 * its bundle.
 */

/** Schema node name of the Wrapper in the engine (ADR-0057). */
export const WRAPPER_NODE = "wrapper";
