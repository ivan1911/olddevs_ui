/**
 * The consumer configuration, exactly as described in docs/getting-started.md.
 *
 * `optimizePackageImports` is not a decoration here: without it, a page with a
 * single `Button` weighs 408 kB instead of 114 at the 102 baseline (ADR-0029).
 * If the line is removed, the size budget job turns red. That is the check that
 * the documentation has not drifted from reality.
 *
 * `@olddevs/ui/editor` is a separate line: the root entry does not cover the
 * subpath, which was verified by measurement. Without it, `RichTextView` used in
 * a Server Component pulls the whole editor with its engine into the client:
 * 435 kB instead of 137 on the `/editor` page.
 */
export default {
  experimental: { optimizePackageImports: ["@olddevs/ui", "@olddevs/ui/editor"] },
};
