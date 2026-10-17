// The `process` type is declared here, not taken from `@types/node`: the package build does not
// include Node types, and pulling them in for a single field is pointless.
declare const process: { env: { NODE_ENV?: string } };

/**
 * A warning to the consumer in development mode, once per message.
 *
 * WHY. Types catch a contract violation on the consumer's side in TypeScript, but not on the consumer's
 * side in JS: two mutually exclusive props arrive silently, and one of them silently loses. The warning
 * closes exactly this gap. The rules for when it is appropriate are in `docs/conventions.md`, section
 * "Development-mode warnings".
 *
 * HOW THE MODE IS DETERMINED. The package ships as plain `tsc` output, without a bundler, so the value of
 * `process.env.NODE_ENV` is not baked into `dist`. The consumer's build substitutes it (Vite, Next,
 * webpack, esbuild with `define`), and in a production build the warning branch is removed as dead code.
 * Without a bundler (Node, a browser with native modules) `process` is not defined: a reference to it
 * throws a `ReferenceError`, which is also "silent". So it is `try/catch`, not
 * `typeof process !== "undefined"`: a bundler does not replace that check, and in a Vite browser build,
 * where `process` does not exist, the warning would never fire, not even in development. For `try/catch`,
 * the substitution of the form `"development" !== "production"` remains a constant, not a function call.
 *
 * Read on every call, not at module load: tests replace the value through `vi.stubEnv`.
 *
 * `@internal`: not exported from the package.
 */
function isDevelopment(): boolean {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

/** Messages that have already been shown. The key is the text itself. */
const shown = new Set<string>();

/**
 * Write a warning to the console: in development only, and only the first time.
 *
 * "Once" is needed because the call sits in the render body: a list row re-renders hundreds of times,
 * and `StrictMode` calls render twice. The key is the message text, so the text must not contain
 * changing data: two different values would give two warnings about the same thing.
 *
 * The text is in English (ADR-0034: the console is an audience outside the kit), and it names what was
 * passed, which one took precedence, and how to fix it.
 */
export function devWarn(message: string): void {
  if (!isDevelopment() || shown.has(message)) return;
  shown.add(message);
  // The only place in the kit where `console` is legitimate: a warning is itself the output.
  // eslint-disable-next-line no-console
  console.warn(message);
}

/** Forget what has been shown. Needed only by tests: the state lives at module level. */
export function resetDevWarnings(): void {
  shown.clear();
}

/**
 * A consumer error to the console: in development only, and only the first time, like `devWarn`.
 * For something that breaks the component as a whole (the Editor's set of Tools is assembled with an
 * error): the field itself shows the user a line from the catalog, while the developer needs the cause.
 *
 * `cause` is the caught exception. It goes to the console as the second argument, not into the text.
 * The "once" key is the text, and the exception's message inside it would make every error look new.
 * The console, however, shows the stack for an `Error` object.
 */
export function devError(message: string, cause?: unknown): void {
  if (!isDevelopment() || shown.has(message)) return;
  shown.add(message);
  // eslint-disable-next-line no-console
  if (cause === undefined) console.error(message);
  // eslint-disable-next-line no-console
  else console.error(message, cause);
}
