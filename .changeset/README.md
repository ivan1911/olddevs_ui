# Changesets

Every change a consumer can see brings a file here: a short entry on what changed and how much it breaks. The
version number and `CHANGELOG.md` are built from these entries.

```bash
npm run changeset          # add an entry
npm run release:version    # apply them: bump the version and update the CHANGELOG
```

`release:version` only prepares a release; publishing the package is a separate maintainer step and never
happens automatically.

What goes into an entry:

- **patch** — a fix that does not change the contract;
- **minor** — a new component, a new prop, a new message catalog string;
- **major** — a breaking change; it also needs an entry in
  [`docs/api/migration-notes.md`](../docs/api/migration-notes.md) with the action it requires from the consumer.

Write entries in English: they go to the public `CHANGELOG.md`. The entry is read by the consumer, not the
author: "`Table` no longer sorts on a header click without `sortable`" is more useful than "fixed a sorting bug".
