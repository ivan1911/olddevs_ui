import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./components/actions/Button.js";
import { Alert } from "./components/actions/Alert.js";
import { Card } from "./components/content/Card.js";
import { Checkbox } from "./components/inputs/Checkbox.js";
import { CheckboxGroup } from "./components/inputs/CheckboxGroup.js";
import { Chip } from "./components/actions/Chip.js";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./components/overlays/ContextMenu.js";
import { EmptyState } from "./components/content/EmptyState.js";
import { Form } from "./components/inputs/Form.js";
import { FormField } from "./components/inputs/FormField.js";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "./components/overlays/Menu.js";
import { NumberInput } from "./components/inputs/NumberInput.js";
import { PageHeader } from "./components/navigation/PageHeader.js";
import { Progress } from "./components/actions/Progress.js";
import { Radio, RadioGroup } from "./components/inputs/RadioGroup.js";
import { SearchControl } from "./components/inputs/SearchControl.js";
import { SectionHeader } from "./components/navigation/SectionHeader.js";
import { Segmented } from "./components/actions/Segmented.js";
import { Select } from "./components/inputs/Select.js";
import { Skeleton } from "./components/content/Skeleton.js";
import { Spinner } from "./components/actions/Spinner.js";
import { StatusBadge } from "./components/actions/StatusBadge.js";
import { Tabs } from "./components/navigation/Tabs.js";
import { Text } from "./components/content/Text.js";
import { TextControl } from "./components/inputs/TextControl.js";
import { Toaster, toast } from "./components/actions/Toaster.js";
import { Toggle } from "./components/actions/Toggle.js";
import { TooltipProvider } from "./components/overlays/Tooltip.js";
import {
  AddIcon,
  ArchiveIcon,
  CopyIcon,
  DeleteIcon,
  EditIcon,
  GridDenseIcon,
  GridSparseIcon,
  MoreIcon,
  SearchIcon,
} from "./icons.js";

/**
 * Kitchen sink — четыре экрана, собранные ТОЛЬКО из экспортов пакета.
 *
 * Это приёмка волн, а не витрина. У новых компонентов нет потребителя: пакет
 * растёт под будущие проекты, а не под текущий фронт, поэтому обычная проверка
 * «внедрено и работает» здесь недоступна. Экран её заменяет — компонент
 * попадает в `index.ts` только после того, как отработал в одном из них.
 *
 * ПРАВИЛО, по которому экран считается собранным:
 *
 *   можно — раскладочные классы: `flex`, `grid`, `gap-*`, `w-*`, `max-w-*`,
 *           `col-span-*`. Это работа потребителя, и она остаётся ему.
 *   нельзя — всё, что задаёт вид: цвета, рамки, тени, скругления, размеры
 *           текста, состояния. Если экрану это понадобилось, значит в пакете
 *           дырка, и волна не закрыта.
 *
 * Экраны — каркасы: волны их дописывают, а не переписывают. Что чем
 * дополняется, отмечено комментарием TODO у каждого экрана; в снимках видно
 * ровно то, что волна добавила.
 */
const meta = {
  title: "Screens/Kitchen sink",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const CATEGORIES = [
  { id: "nature", label: "Nature", meta: 128 },
  { id: "city", label: "City", meta: 64 },
  { id: "abstract", label: "Abstract", meta: 91 },
];

/**
 * Форма настроек.
 *
 * TODO W8: `Combobox` для категории, `Slider` для лимита.
 */
export const SettingsForm: Story = {
  render: function Render() {
    const [name, setName] = useState("Daily album");
    // `string | number | null` руками, а не `SelectId | null`: тип есть в
    // сигнатуре `SelectProps`, но из пакета не экспортирован. Первая дырка,
    // которую нашёл kitchen-sink; чинится отдельной задачей.
    const [category, setCategory] = useState<string | number | null>("nature");
    const [perDay, setPerDay] = useState<number | null>(3);
    const [caption, setCaption] = useState("Album of the week: peaks and fog");
    const [mode, setMode] = useState<string | null>("later");
    const [channels, setChannels] = useState<string[]>(["tg"]);
    const [notify, setNotify] = useState(true);
    const [pin, setPin] = useState(false);

    return (
      <div className="mx-auto flex max-w-[560px] flex-col gap-4">
        <PageHeader title="Album settings" subtitle="How and where this album is published" />
        <Form onSubmit={() => {}}>
          <Card className="flex flex-col gap-4">
            <SectionHeader title="General" />
            <FormField label="Name" htmlFor="ks-name" required>
              <TextControl
                id="ks-name"
                name="title"
                value={name}
                onChange={(e) => setName(e.target.value)}
                shellClassName="w-full"
              />
            </FormField>
            <FormField
              label="Category"
              htmlFor="ks-category"
              hint="Sets the feed the album lands in"
            >
              <Select
                items={CATEGORIES}
                value={category}
                onChange={setCategory}
                placeholder="Category"
                highlightSelected={false}
                triggerClassName="w-full px-3 py-2.5 [--select-label-max:none]"
              />
            </FormField>
            <FormField label="Posts per day" error="No more than 12 on the free plan">
              <NumberInput
                label="Posts per day"
                value={perDay}
                onChange={setPerDay}
                min={1}
                max={24}
                invalid
                shellClassName="w-full"
              />
            </FormField>
            <FormField label="Caption" htmlFor="ks-caption">
              <TextControl
                id="ks-caption"
                as="textarea"
                autosize
                rows={2}
                maxRows={6}
                showCount
                maxLength={280}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                shellClassName="w-full"
              />
            </FormField>
          </Card>

          <Card className="flex flex-col gap-4">
            <SectionHeader title="Publishing" />
            <RadioGroup label="When to publish" value={mode} onChange={setMode}>
              <Radio value="now">Right away</Radio>
              <Radio value="later" description="In the next free slot">
                On schedule
              </Radio>
            </RadioGroup>
            <CheckboxGroup
              label="Where to publish"
              value={channels}
              onChange={setChannels}
              description="Pick more than one"
            >
              <Checkbox value="tg">Telegram</Checkbox>
              <Checkbox value="vk">VK</Checkbox>
              <Checkbox value="ok" disabled>
                OK — channel not connected
              </Checkbox>
            </CheckboxGroup>
            <Checkbox checked={pin} onCheckedChange={setPin} description="Unpins in a day">
              Pin the first post
            </Checkbox>
            <FormField label="Notifications" hint="Send a report after publishing">
              <Toggle label="Send a report" checked={notify} onCheckedChange={setNotify} />
            </FormField>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="ghost">Cancel</Button>
            <Button type="submit" variant="solid" tone="accent">
              Save
            </Button>
          </div>
        </Form>
      </div>
    );
  },
};

/**
 * Экран данных: фильтры, поиск, список.
 *
 * TODO W9: `Pagination`, `Breadcrumbs`. TODO W10: настоящая `Table` вместо
 * карточек-строк, `Badge`-счётчик у фильтров.
 */
export const DataScreen: Story = {
  render: function Render() {
    const [search, setSearch] = useState("");
    const [density, setDensity] = useState("sparse");
    const [onlyDrafts, setOnlyDrafts] = useState(false);

    const rows = [
      { id: 1, title: "Mountain sunrise", tone: "success" as const, status: "Published" },
      { id: 2, title: "Night city", tone: "warning" as const, status: "Queued" },
      { id: 3, title: "Geometry of light", tone: "neutral" as const, status: "Draft" },
    ];

    // `TooltipProvider` обязателен вокруг `Segmented` с подсказками: провайдер
    // намеренно не встроен в каждый экземпляр (см. докстроку `Tooltip`), и без
    // него сегменты с одной лишь иконкой остаются без доступного имени.
    return (
      <TooltipProvider delayDuration={0}>
        <div className="flex flex-col gap-4">
          <PageHeader
            title="Library"
            subtitle="283 photos"
            actions={
              <Button variant="solid" tone="accent" icon={<AddIcon size={16} />}>
                Upload
              </Button>
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <SearchControl
              label="Find photos"
              value={search}
              onChange={setSearch}
              placeholder="Find photos…"
              shellClassName="w-[240px] rounded-full px-3 py-2"
            />
            <Chip
              selected={onlyDrafts}
              tone="accent"
              onClick={() => setOnlyDrafts((v) => !v)}
              count={12}
            >
              Drafts
            </Chip>
            <div className="ml-auto">
              <Segmented
                value={density}
                onChange={setDensity}
                options={[
                  { value: "sparse", icon: <GridSparseIcon size={15} />, tooltip: "Large grid" },
                  { value: "dense", icon: <GridDenseIcon size={15} />, tooltip: "Dense grid" },
                ]}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <ContextMenu key={row.id}>
                <ContextMenuTrigger>
                  <Card size="sm" className="flex items-center gap-3">
                    <Skeleton width={48} height={32} borderRadius={6} />
                    <span className="flex-1">{row.title}</span>
                    <StatusBadge tone={row.tone} dot>
                      {row.status}
                    </StatusBadge>
                    <MenuTrigger>
                      <MenuButton
                        icon={<MoreIcon size={16} />}
                        iconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={`Actions: ${row.title}`}
                      />
                      <Menu placement="bottom end">
                        <MenuItem icon={<EditIcon size={14} />} onAction={() => {}}>
                          Rename
                        </MenuItem>
                        <MenuItem icon={<CopyIcon size={14} />} shortcut="⌘D" onAction={() => {}}>
                          Duplicate
                        </MenuItem>
                        <MenuItem icon={<ArchiveIcon size={14} />} onAction={() => {}}>
                          Archive
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem tone="danger" icon={<DeleteIcon size={14} />} onAction={() => {}}>
                          Delete
                        </MenuItem>
                      </Menu>
                    </MenuTrigger>
                  </Card>
                </ContextMenuTrigger>
                {/*
                  Те же действия по правой кнопке мыши. Состав пунктов повторён
                  намеренно: это два способа добраться до одного и того же, и
                  расхождение между ними было бы дефектом, а не экономией. Вид у
                  обоих общий, из `lib/menu.ts`.
                */}
                <ContextMenuContent>
                  <ContextMenuItem icon={<EditIcon size={14} />}>Rename</ContextMenuItem>
                  <ContextMenuItem icon={<CopyIcon size={14} />} shortcut="⌘D">
                    Duplicate
                  </ContextMenuItem>
                  <ContextMenuItem icon={<ArchiveIcon size={14} />}>Archive</ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem tone="danger" icon={<DeleteIcon size={14} />}>
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        </div>
      </TooltipProvider>
    );
  },
};

/**
 * Мастер из шагов.
 *
 * Навигация шагов пока на `Tabs` — это заглушка. TODO W9: настоящий `Stepper`
 * с пройденными и недоступными шагами.
 */
export const Wizard: Story = {
  render: function Render() {
    const [step, setStep] = useState("source");
    const [source, setSource] = useState<string | number | null>("nature");
    const [caption, setCaption] = useState("");
    const [limit, setLimit] = useState<number | null>(20);
    const [kinds, setKinds] = useState<string[]>(["new"]);
    const [pending, setPending] = useState(false);

    const steps = [
      { id: "source", label: "Source" },
      { id: "content", label: "Content" },
      { id: "schedule", label: "Schedule" },
    ];

    return (
      <div className="mx-auto flex max-w-[560px] flex-col gap-4">
        <PageHeader title="New campaign" subtitle="Step 1 of 3" />
        <Tabs items={steps} value={step} onChange={setStep} />
        {/* `id` и `role` обязательны: `Tabs` проставляет выбранной вкладке
            `aria-controls="${id}-panel"`, и без такой панели axe роняет
            прогон на `aria-valid-attr-value`. */}
        <Form onSubmit={() => setPending(true)} pending={pending}>
          <Card id={`${step}-panel`} role="tabpanel" className="flex flex-col gap-4">
            <FormField label="Where photos come from" htmlFor="ks-source" required>
              <Select
                items={CATEGORIES}
                value={source}
                onChange={setSource}
                placeholder="Category"
                highlightSelected={false}
                triggerClassName="w-full px-3 py-2.5 [--select-label-max:none]"
              />
            </FormField>
            <CheckboxGroup
              label="What to include"
              value={kinds}
              onChange={setKinds}
              orientation="horizontal"
            >
              <Checkbox value="new">New</Checkbox>
              <Checkbox value="top">Popular</Checkbox>
              <Checkbox value="fav">Favourites</Checkbox>
            </CheckboxGroup>
            <FormField label="How many photos to take">
              <NumberInput
                label="How many photos to take"
                value={limit}
                onChange={setLimit}
                min={1}
                max={100}
                shellClassName="w-full"
              />
            </FormField>
            <FormField label="Caption" htmlFor="ks-wizard-caption" hint="Shown under every post">
              <TextControl
                id="ks-wizard-caption"
                as="textarea"
                autosize
                rows={2}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="For example: album of the week"
                shellClassName="w-full"
              />
            </FormField>
          </Card>
          <div className="flex justify-between">
            <Button variant="ghost" disabled>
              Back
            </Button>
            <Button type="submit" variant="solid" tone="accent">
              Next
            </Button>
          </div>
        </Form>
      </div>
    );
  },
};

/**
 * Дашборд: плитки, состояния и сообщения.
 *
 * Экран собран на типографической шкале волны 7: ни одного `text-[…]` и ни
 * одного размера мимо неё — весь текст идёт через `Text` и `Heading`.
 *
 * Уровни заголовков непрерывны: `PageHeader` даёт `h1`, заголовки карточек
 * стоят вторым уровнем (`SectionHeader level={2}`), подписи внутри плитки —
 * третьим. Между `h1` и `h3` дыры нет, и оглавление для скринридера читается
 * подряд — это проверяет аудит axe.
 *
 * TODO W10: `Stat` вместо самодельных плиток.
 */
export const Dashboard: Story = {
  render: function Render() {
    return (
      <div className="flex flex-col gap-4">
        <Toaster position="top-right" />
        <PageHeader
          title="Summary"
          subtitle="Over the last 7 days"
          actions={
            <Button variant="soft" onClick={() => toast.success("Report sent by email")}>
              Send the report
            </Button>
          }
        />

        <Alert
          tone="warning"
          title="VK channel is not connected"
          action={
            <Button size="sm" variant="solid" tone="warning">
              Connect
            </Button>
          }
          onDismiss={() => {}}
        >
          Nothing will be published there until you connect it.
        </Alert>

        <div className="grid grid-cols-3 gap-3">
          <Card className="flex flex-col gap-1">
            <SectionHeader title="Subscribers" size="sm" level={2} />
            <Text size="lg" weight="bold">
              12 480
            </Text>
            <Text size="caption" level={3}>
              +320 this week
            </Text>
          </Card>
          <Card className="flex flex-col gap-1">
            <SectionHeader title="Posts" size="sm" level={2} />
            <Text size="lg" weight="bold">
              36
            </Text>
            <Text size="caption" level={3}>
              2 of them manual
            </Text>
          </Card>
          <Card className="flex flex-col gap-2">
            <SectionHeader title="Daily limit" size="sm" level={2} />
            <Progress value={72} label="Daily publishing limit" showValue />
          </Card>
        </div>

        <Card className="flex flex-col gap-3">
          <SectionHeader
            title="Photo upload"
            size="sm"
            level={2}
            right={
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                <Text as="span" size="sm" level={2}>
                  Processing
                </Text>
              </span>
            }
          />
          <Progress value={null} label="Processing uploaded files" />
          <div className="flex flex-col gap-2">
            <Skeleton width="100%" height={10} />
            <Skeleton width="60%" height={10} />
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Alert tone="success" title="Published successfully">
            36 posts went out on schedule.
          </Alert>
          <Alert tone="danger" title="Two posts did not go out">
            Telegram answered 429 — too often.
          </Alert>
        </div>

        <Card>
          <EmptyState
            icon={<SearchIcon size={28} strokeWidth={1.5} />}
            title="Nothing here yet"
            description="Publishing and error notifications will show up here."
          />
        </Card>
      </div>
    );
  },
};
