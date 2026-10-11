# @olddevs/ui

## 4.0.1

### Patch Changes

- The first release built in GitHub Actions, with npm provenance: the package page links the build to the commit and the workflow that produced it. Releases are staged by the workflow and approved by the maintainer on npmjs.com. No changes to the code or the API.

## 4.0.0

### Major Changes

- First public release: the package is published to npmjs.com under the MIT License, and the source is on GitHub.

  - **License:** MIT, previously `UNLICENSED`. Third-party notices stay in `NOTICE`.
  - **Registry:** install from npmjs.com with `npm i @olddevs/ui`. If your `.npmrc` binds the `@olddevs` scope to another registry, remove that line and regenerate the lock file.
  - **Versioning:** strict semver from this release on. Breaking changes ship only in a major version, and a public API rename keeps the old name as a deprecated alias for one major version.
  - **No API changes:** code that works with 3.49 works with 4.0.0 as is. See `docs/api/migration-notes.md`, entry 4.0.0.
  - This changelog starts with this release.
