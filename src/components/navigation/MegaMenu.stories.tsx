import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import {
  BellIcon,
  DesktopIcon,
  GameIcon,
  HealthIcon,
  HomeIcon,
  ListIcon,
  MobileIcon,
  PaletteIcon,
  PurchaseIcon,
  ReadingIcon,
  TripIcon,
} from "../../icons.js";
import { TopBar } from "../app-shell/TopBar.js";
import { Button } from "../actions/Button.js";
import {
  MegaMenu,
  MegaMenuButton,
  MegaMenuCategory,
  MegaMenuGroup,
  MegaMenuLink,
  MegaMenuTrigger,
} from "./MegaMenu.js";

const meta = {
  title: "Navigation/MegaMenu",
  component: MegaMenu,
  parameters: { layout: "padded" },
} satisfies Meta<typeof MegaMenu>;

export default meta;
type Story = StoryObj;

function Group({ title, links }: { title: string; links: string[] }) {
  return (
    <MegaMenuGroup title={title} href="#">
      {links.map((link) => (
        <MegaMenuLink key={link} href="#" active={link === "Laptops"}>
          {link}
        </MegaMenuLink>
      ))}
    </MegaMenuGroup>
  );
}

/** A promo card: its own content in the flyout, alongside the link columns. */
function Promo({ children }: { children: ReactNode }) {
  return (
    <div className="bg-accent-soft text-accent-strong rounded-md p-3 text-[13px]">
      <div className="mb-1 font-semibold">This week</div>
      {children}
    </div>
  );
}

/**
 * A store catalog: about ten categories, link columns, a promo, a link without a flyout,
 * and a disabled category. The current page is "Laptops", so "Computers" is marked as
 * the current section (`active`).
 */
function StoreCatalog(props: { defaultValue?: string | null }) {
  return (
    <MegaMenu aria-label="Catalog" {...props}>
      <MegaMenuCategory
        id="computers"
        label="Computers"
        icon={<DesktopIcon size={16} />}
        href="#"
        active
      >
        <Group title="Computers" links={["Laptops", "Desktops", "Monitors", "Tablets"]} />
        <Group title="Components" links={["Graphics cards", "Processors", "Memory", "Storage"]} />
        <Group title="Accessories" links={["Keyboards", "Mice", "Webcams", "Headsets"]} />
        <Promo>Up to 30% off monitors</Promo>
      </MegaMenuCategory>
      <MegaMenuCategory id="phones" label="Phones" icon={<MobileIcon size={16} />} href="#">
        <Group title="Smartphones" links={["Android", "iPhone", "Refurbished"]} />
        <Group title="Accessories" links={["Cases", "Chargers", "Screen protectors"]} />
      </MegaMenuCategory>
      <MegaMenuCategory id="books" label="Books" icon={<ReadingIcon size={16} />} href="#">
        <Group title="Fiction" links={["Novels", "Fantasy", "Mystery", "Poetry"]} />
        <Group title="Non-fiction" links={["Biographies", "History", "Science"]} />
        <Group title="Kids" links={["Picture books", "Young adult"]} />
      </MegaMenuCategory>
      <MegaMenuCategory id="games" label="Video games" icon={<GameIcon size={16} />}>
        <Group title="Consoles" links={["PlayStation", "Xbox", "Nintendo"]} />
        <Group title="PC gaming" links={["Games", "Controllers"]} />
      </MegaMenuCategory>
      <MegaMenuCategory id="home" label="Home and garden" icon={<HomeIcon size={16} />}>
        <Group title="Kitchen" links={["Cookware", "Small appliances", "Tableware"]} />
        <Group title="Garden" links={["Tools", "Plants", "Outdoor furniture"]} />
      </MegaMenuCategory>
      <MegaMenuCategory id="art" label="Arts, crafts and sewing" icon={<PaletteIcon size={16} />}>
        <Group title="Painting" links={["Paints", "Brushes", "Canvases"]} />
        <Group title="Sewing" links={["Fabric", "Machines", "Notions"]} />
      </MegaMenuCategory>
      <MegaMenuCategory id="health" label="Health" icon={<HealthIcon size={16} />}>
        <Group title="Personal care" links={["Oral care", "Shaving", "Skin care"]} />
      </MegaMenuCategory>
      <MegaMenuCategory id="travel" label="Travel" icon={<TripIcon size={16} />} disabled>
        <Group title="Luggage" links={["Suitcases", "Backpacks"]} />
      </MegaMenuCategory>
      <MegaMenuCategory
        id="deals"
        label="Today's deals"
        icon={<PurchaseIcon size={16} />}
        href="#"
      />
    </MegaMenu>
  );
}

/** Hover over a category: its flyout opens right away. */
export const Catalog: Story = {
  render: () => (
    <div className="min-h-[480px]">
      <StoreCatalog />
    </div>
  ),
};

/** An open flyout, for snapshots and for reviewing the look. */
export const Open: Story = {
  render: () => (
    <div className="min-h-[480px]">
      <StoreCatalog defaultValue="computers" />
    </div>
  ),
};

/**
 * The dropdown variant: the "Catalog" button in the top bar opens the same markup in an overlay
 * below it. A click, Enter, Space, or Down Arrow opens it; hovering does not.
 * Escape, a click outside, a second click on the button, and following a link all close it.
 */
export const DropdownInTopBar: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <ShopTopBar />,
};

function ShopTopBar(props: { defaultOpen?: boolean; defaultValue?: string | null }) {
  return (
    <div className="min-h-[560px]">
      <TopBar
        brand={
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold tracking-tight">Shop</span>
            <MegaMenuTrigger defaultOpen={props.defaultOpen}>
              <MegaMenuButton variant="soft" icon={<ListIcon size={16} />}>
                Catalog
              </MegaMenuButton>
              <StoreCatalog defaultValue={props.defaultValue} />
            </MegaMenuTrigger>
          </div>
        }
        actions={<Button variant="ghost" iconOnly icon={<BellIcon />} aria-label="Notifications" />}
      />
    </div>
  );
}

/**
 * The dropdown variant at phone width: the overlay spans the full window width, not the content
 * width, so labels wrap and the width does not jump when it drops down.
 * The `viewport-phone` tag: a snapshot at 375px.
 */
export const PhoneDropdown: Story = {
  tags: ["viewport-phone"],
  parameters: { layout: "fullscreen" },
  render: () => <ShopTopBar defaultOpen />,
};

/** The dropdown variant on a phone after a tap on a category: its flyout replaces the category column, inside the overlay. */
export const PhoneDropdownDrillDown: Story = {
  tags: ["viewport-phone"],
  parameters: { layout: "fullscreen" },
  render: () => <ShopTopBar defaultOpen defaultValue="computers" />,
};

/**
 * The category column at phone width: full width, labels wrap rather than being cut off.
 *
 * The `viewport-phone` tag: the visual test takes a snapshot of this story at 375px, where
 * the narrow rule applies. In a regular window, narrow it below 640px.
 */
export const PhoneColumn: Story = {
  tags: ["viewport-phone"],
  render: () => (
    <div className="min-h-[480px]">
      <StoreCatalog />
    </div>
  ),
};

/**
 * Narrow screen: a tap on a category replaces the category column with its flyout, which has a
 * "Back" row and the category's name. Here the flyout is open right away, for the snapshot; in the
 * live story, tap "Computers".
 */
export const PhoneDrillDown: Story = {
  tags: ["viewport-phone"],
  render: () => (
    <div className="min-h-[480px]">
      <StoreCatalog defaultValue="computers" />
    </div>
  ),
};
