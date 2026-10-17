# Contributing to Olddevs UI

Thanks for your interest in `@olddevs/ui`. This page explains how the project works and how to get a change in.

By taking part, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem, see [SECURITY.md](SECURITY.md) and don't open a public issue.

## How development works

Development happens in a private repository. This GitHub repository is a public mirror of the same history. It is updated with each release, not with each commit, so the latest commit here can be behind the work in progress.

## Issues

Issues are welcome for bug reports and ideas. Questions about the API go to [Discussions](https://github.com/ivan1911/olddevs_ui/discussions). Use one of the issue forms and include what we need to reproduce the problem or understand the idea:

- the versions of `@olddevs/ui` and React;
- your browser and operating system;
- a minimal example, if you can make one.

Check the [documentation](https://ui.olddevs.ru) and existing issues first.

## Pull requests

You can open a pull request, but it won't be merged on GitHub, because the source of truth is the private repository. Here is what happens instead:

1. The maintainer reviews your pull request here.
2. If the change is accepted, the maintainer applies it to the private repository with `git am`, so the commit keeps your authorship.
3. After the next release, the pull request is closed with a link to your commit in this repository.

For anything larger than a small fix, open an issue first, so we can agree on the approach before you write the code.

## Setting up

You need npm and Node.js 20.19+, 22.19+ or 24+ (the minimums that Vite and Storybook ask for; the GitHub Actions workflows run on Node 24). Install the dependencies with:

```bash
npm ci
```

[README.md](README.md) describes the package and how to use it. [AGENTS.md](AGENTS.md) holds the working rules for the codebase, including the public API boundary and the quality bar for components. The Reference (the [`docs/`](docs/index.md) folder in the package) describes every component.

## Before you send a patch

Run these checks and make sure they pass:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

[AGENTS.md](AGENTS.md#checks) lists the full set of checks under "Checks". Visual snapshots (`npm run test:visual`) depend on the platform, so we compare them only on our own machine. Don't commit updated snapshots.

Heavy checks run locally, not in GitHub Actions: the workflows only build and publish the package on a tag and deploy Storybook. So the checks above are the only gate a change passes before release, and running them is part of the patch.

If you add or change a component, update its page in `docs/components/` in the same change. The Reference is written in English, one file per page. The Russian translation is kept on the documentation site and is brought up to date by the maintainers, so you don't need to write Russian.

## Commit messages

Write commit messages as [Conventional Commits](https://www.conventionalcommits.org/), for example:

```text
fix(select): keep the highlighted option in view while typing
```

## Versioning

Since 4.0.0, the package follows strict [semver](https://semver.org/): breaking changes ship only in a major version. A public API rename keeps the old name as a deprecated alias for one major version. The public API is every entry point listed in the `exports` field of `package.json`: `@olddevs/ui`, `@olddevs/ui/icons`, `@olddevs/ui/color`, `@olddevs/ui/editor`, `@olddevs/ui/editor/schema`, `@olddevs/ui/editor/highlight`, `@olddevs/ui/locales/ru`, `@olddevs/ui/locales/en` and `@olddevs/ui/styles.css`. A path in `src/` is not public.

## References you may find in the code

- `ADR-NNNN` (for example `ADR-0013`) is the number of an architecture decision record. The records are kept separately from the code, so there is no file in this repository for them. The comment next to the reference usually states the decision.
- `OLDSUI-<number>` in tests and commit messages is a task number in the maintainer's private tracker; you can ignore it.
