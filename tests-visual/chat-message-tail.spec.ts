import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

/** A crop alone can be approved with a defect. These independent interior-pixel checks
 * reject an extra branch even if someone regenerates every golden image. */
for (const dpr of [1, 2]) {
  test.describe(`tail dpr${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    for (const theme of ["light", "dark", "dim"]) {
      for (const radius of ["none", "small", "medium", "large"]) {
        test(`${theme} ${radius}: one compact contour`, async ({ page }, info) => {
          const records = [];
          for (const [story, position] of [
            ["single-bubbles", "single"],
            ["grouped-bubbles", "last"],
          ] as const) {
            await page.goto(
              `/iframe.html?id=content-chatmessage-bubbles--${story}&globals=theme:${theme};accent:blue`
            );
            await page.locator("body.sb-show-main").waitFor({ state: "attached" });
            await page
              .locator("#storybook-root")
              .evaluate((node, radius) => node.setAttribute("data-radius", radius), radius);
            await page.evaluate(async () => {
              await document.fonts.ready;
              await new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
              );
            });
            for (const speaker of ["user", "assistant"] as const) {
              const article = page.locator(
                `article[data-speaker="${speaker}"][data-group-position="${position}"]`
              );
              const geometry = await article.evaluate((node, speaker) => {
                const box = node.getBoundingClientRect();
                const svg = node.querySelector(":scope > svg")!;
                const tail = svg.getBoundingClientRect();
                const outline = svg.querySelector('path[fill="none"]') as SVGPathElement;
                const start = outline.getPointAtLength(0).matrixTransform(outline.getScreenCTM()!);
                const css = getComputedStyle(node);
                const edge = speaker === "assistant" ? box.left : box.right;
                const borderCenter =
                  speaker === "assistant"
                    ? edge + parseFloat(css.borderLeftWidth) / 2
                    : edge - parseFloat(css.borderRightWidth) / 2;
                return {
                  box: {
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                    bottom: box.bottom,
                  },
                  edge,
                  borderCenter,
                  attachment: { x: start.x, y: start.y },
                  attachmentOffset: Math.abs(start.x - borderCenter),
                  tailHeight: tail.height,
                  protrusion:
                    speaker === "assistant" ? box.left - tail.left : tail.right - box.right,
                  background: css.backgroundColor
                    .match(/[\d.]+/g)!
                    .slice(0, 3)
                    .map(Number),
                  path: outline.getAttribute("d"),
                };
              }, speaker);
              const clip = {
                x: Math.floor(geometry.edge - 17),
                y: Math.floor(geometry.box.bottom - 30),
                width: 36,
                height: 34,
              };
              const png = await page.screenshot({ clip, animations: "disabled", scale: "device" });
              const pixels = await page.evaluate(
                async ({ encoded, clip, geometry, speaker }) => {
                  const image = new Image();
                  image.src = `data:image/png;base64,${encoded}`;
                  await image.decode();
                  const canvas = document.createElement("canvas");
                  canvas.width = image.naturalWidth;
                  canvas.height = image.naturalHeight;
                  const context = canvas.getContext("2d")!;
                  context.drawImage(image, 0, 0);
                  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
                  const scale = canvas.width / clip.width;
                  let interiorMaxDeviation = 0,
                    lowerSeamMaxDeviation = 0,
                    interiorCount = 0,
                    lowerCount = 0;
                  for (let y = 0; y < canvas.height; y++)
                    for (let x = 0; x < canvas.width; x++) {
                      const globalX = clip.x + (x + 0.5) / scale;
                      const globalY = clip.y + (y + 0.5) / scale;
                      const inset =
                        speaker === "assistant" ? globalX - geometry.edge : geometry.edge - globalX;
                      const fromBottom = geometry.box.bottom - globalY;
                      const offset = (y * canvas.width + x) * 4;
                      const deviation = Math.max(
                        ...geometry.background.map((color, channel) =>
                          Math.abs(data[offset + channel]! - color)
                        )
                      );
                      // An inward second outline branch is never valid inside this padding strip.
                      if (inset >= 1.25 && inset <= 3.75 && fromBottom >= 2 && fromBottom <= 26) {
                        interiorCount++;
                        interiorMaxDeviation = Math.max(interiorMaxDeviation, deviation);
                      }
                      // Once the tail curves outside, the old straight border must be fully covered.
                      if (inset >= 0 && inset <= 1 && fromBottom >= 2 && fromBottom <= 5) {
                        lowerCount++;
                        lowerSeamMaxDeviation = Math.max(lowerSeamMaxDeviation, deviation);
                      }
                    }
                  return {
                    interiorMaxDeviation,
                    lowerSeamMaxDeviation,
                    interiorCount,
                    lowerCount,
                    scale,
                  };
                },
                { encoded: png.toString("base64"), clip, geometry, speaker }
              );
              const name = `tail-dpr${dpr}-${theme}-${radius}-${speaker}-${position}`;
              records.push({ name, geometry, pixels });
              if (process.env.TAIL_EVIDENCE_DIR) {
                await mkdir(process.env.TAIL_EVIDENCE_DIR, { recursive: true });
                await writeFile(join(process.env.TAIL_EVIDENCE_DIR, `${name}.png`), png);
              }
              expect.soft(pixels.interiorCount).toBeGreaterThan(20);
              expect.soft(pixels.lowerCount).toBeGreaterThan(0);
              expect
                .soft(
                  pixels.interiorMaxDeviation,
                  `${name}: an outline branch crosses the inside padding strip`
                )
                .toBeLessThanOrEqual(2);
              expect
                .soft(
                  pixels.lowerSeamMaxDeviation,
                  `${name}: old vertical border remains inside the tail`
                )
                .toBeLessThanOrEqual(2);
              expect
                .soft(
                  geometry.attachmentOffset,
                  `${name}: curve must attach at the body border center`
                )
                .toBeLessThan(0.01);
              expect.soft(geometry.protrusion).toBeGreaterThanOrEqual(8);
              expect.soft(geometry.protrusion).toBeLessThanOrEqual(10);
              expect.soft(geometry.tailHeight).toBeGreaterThanOrEqual(12);
              expect.soft(geometry.tailHeight).toBeLessThanOrEqual(14);
              if (
                radius === "medium" &&
                pixels.interiorMaxDeviation <= 2 &&
                pixels.lowerSeamMaxDeviation <= 2 &&
                geometry.attachmentOffset < 0.01 &&
                geometry.tailHeight <= 14
              ) {
                await expect(png).toMatchSnapshot(`${name}.png`, {
                  threshold: 0,
                  maxDiffPixels: 0,
                });
              }
            }
          }
          const json = JSON.stringify(records, null, 2);
          await info.attach("runtime-junction-measurements", {
            body: json,
            contentType: "application/json",
          });
          if (process.env.TAIL_EVIDENCE_DIR)
            await writeFile(
              join(process.env.TAIL_EVIDENCE_DIR, `measurements-dpr${dpr}-${theme}-${radius}.json`),
              json
            );
        });
      }
    }
  });
}
