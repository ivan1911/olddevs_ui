import type { StorybookConfig } from "@storybook/react-vite";

/** The GA4 stream of the showcase. The ui.olddevs.ru site has a stream of its own. */
const GA_ID = "G-2NRDLQD296";

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
  //
  // The paste cleanup story (OLDSUI-274) pastes real clipboard captures: they are served from the
  // fixtures folder as they are, so the showcase and the tests read the same files.
  staticDirs: ["./static", { from: "../fixtures/paste", to: "/paste-fixtures" }],
  // The Google tag of the public showcase on GitHub Pages. It goes into the manager, not the
  // preview: the manager is the page a reader opens, while every story renders in its own
  // `iframe.html`, so a tag there would count each story twice and send the Playwright checks
  // to the network. GA4 counts switching stories (`?path=` in the address) through its
  // enhanced measurement of history changes. `storybook dev` gets no tag, so local work stays
  // out of the stats.
  managerHead: (head, { configType }) =>
    configType === "PRODUCTION"
      ? `${head}
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_ID}');
</script>`
      : head,
};

export default config;
