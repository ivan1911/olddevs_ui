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
        <MegaMenuLink key={link} href="#" current={link === "Laptops"}>
          {link}
        </MegaMenuLink>
      ))}
    </MegaMenuGroup>
  );
}

/** Промо-карточка — своё содержимое Витрины рядом с колонками. */
function Promo({ children }: { children: ReactNode }) {
  return (
    <div className="bg-accent-soft text-accent-strong rounded-md p-3 text-[13px]">
      <div className="mb-1 font-semibold">This week</div>
      {children}
    </div>
  );
}

/** Каталог магазина: десяток Категорий, колонки ссылок, промо, ссылка без Витрины, выключенная. */
function StoreCatalog(props: { defaultValue?: string | null }) {
  return (
    <MegaMenu aria-label="Catalog" {...props}>
      <MegaMenuCategory id="computers" label="Computers" icon={<DesktopIcon size={16} />} href="#">
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

/** Наведите курсор на Категорию: Витрина открывается сразу. */
export const Catalog: Story = {
  render: () => (
    <div className="min-h-[480px]">
      <StoreCatalog />
    </div>
  ),
};

/** Открытая Витрина — для снимков и обзора вида. */
export const Open: Story = {
  render: () => (
    <div className="min-h-[480px]">
      <StoreCatalog defaultValue="computers" />
    </div>
  ),
};

/**
 * Выпадающий вид: кнопка «Catalog» в шапке открывает ту же разметку в оверлее
 * под собой. Щелчок или Enter, Пробел, стрелка вниз; наведение не открывает.
 * Escape, щелчок снаружи, второй щелчок по кнопке и переход по ссылке закрывают.
 */
export const DropdownInTopBar: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="min-h-[560px]">
      <TopBar
        brand={
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold tracking-tight">Shop</span>
            <MegaMenuTrigger>
              <MegaMenuButton variant="soft" icon={<ListIcon size={16} />}>
                Catalog
              </MegaMenuButton>
              <StoreCatalog />
            </MegaMenuTrigger>
          </div>
        }
        actions={<Button variant="ghost" iconOnly icon={<BellIcon />} aria-label="Notifications" />}
      />
    </div>
  ),
};
