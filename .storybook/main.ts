import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    // react-vite, not nextjs-vite: no component in the package has a single next/*
    // import, so a Next-specific framework would only add dependencies and points
    // of failure.
    name: "@storybook/react-vite",
    options: {},
  },
  // Storybook sends anonymous telemetry on every build by default, including builds
  // from CI. An internal tool does not need that.
  core: { disableTelemetry: true },
  // Images for the Editor's stories: an image's address in a Document must be an
  // absolute http(s) URL, so the file is served by the showcase at that same address
  // instead of being inlined as `data:`, and the snapshots do not depend on the network.
  staticDirs: ["./static"],
};

export default config;
