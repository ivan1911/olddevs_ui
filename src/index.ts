// Расширение ".js" обязательно: NodeNext требует его на этапе компиляции,
// и оно же уезжает в dist, где его ждёт Node ESM.
export { cn } from "./lib/cn.js";
export { useScrollLock } from "./hooks/useScrollLock.js";
export { useTableState } from "./hooks/useTableState.js";
export type { TableStateApi } from "./hooks/useTableState.js";
export {
  DEFAULT_TABLE_STATE,
  tableStateFromParams,
  tableStateToParams,
} from "./lib/table-state.js";
export type { TableFilter, TableState } from "./lib/table-state.js";
export type { ProgressStatus } from "./lib/progress-status.js";
export { SavedViews } from "./components/table/SavedViews.js";
export type { SavedView, SavedViewsProps } from "./components/table/SavedViews.js";
export { useMediaQuery } from "./hooks/useMediaQuery.js";
export { useStickyOffset } from "./hooks/useStickyOffset.js";
export type { StickyOffset, StickyOffsetOptions } from "./hooks/useStickyOffset.js";
export { INVALID_BORDER_CLASS, TONE_TOKENS, variantClasses } from "./lib/variants.js";
export type { ChoiceAppearance } from "./lib/choice-card.js";
export { formatMask, maskCapacity, unmask } from "./lib/mask.js";
export type { Density, Numeric, Size, Tone, Variant, ToneAtoms } from "./lib/variants.js";
export {
  applyTheme,
  DEFAULT_THEME_PREFS,
  normalizeAccent,
  normalizeBrand,
  normalizeTheme,
  themeInitScript,
  UI_ACCENTS,
  UI_BRANDS,
  UI_THEMES,
} from "./lib/themes.js";
export type { UiAccent, UiBrand, UiTheme, UiThemePrefs } from "./lib/themes.js";

export { Alert } from "./components/actions/Alert.js";
export type { AlertProps } from "./components/actions/Alert.js";

export { CopyButton } from "./components/actions/CopyButton.js";
export type { CopyButtonProps } from "./components/actions/CopyButton.js";

export { Truncate } from "./components/actions/Truncate.js";
export type { TruncateProps } from "./components/actions/Truncate.js";

export { VirtualGrid } from "./components/content/VirtualGrid.js";
export type {
  VirtualGridActionDetails,
  VirtualGridItem,
  VirtualGridProps,
} from "./components/content/VirtualGrid.js";

export { SortableList } from "./components/content/SortableList.js";
export type {
  SortableItem,
  SortableListProps,
  SortableMove,
} from "./components/content/SortableList.js";

export { LABEL_BG_CLASS, LABEL_HUES, LABEL_TEXT_CLASS, type LabelHue } from "./lib/variants.js";

export { EditableList } from "./components/content/EditableList.js";
export type {
  EditableListHandle,
  EditableListItem,
  EditableListProps,
} from "./components/content/EditableList.js";

export { MediaCard } from "./components/content/MediaCard.js";
export type { MediaCardProps } from "./components/content/MediaCard.js";

export { NotificationCenter } from "./components/content/NotificationCenter.js";
export type { NotificationCenterProps } from "./components/content/NotificationCenter.js";

export { NotificationItem, NotificationList } from "./components/content/NotificationList.js";
export type {
  NotificationGroup,
  NotificationItemProps,
  NotificationListProps,
} from "./components/content/NotificationList.js";

export { UploadQueue } from "./components/inputs/UploadQueue.js";
export type { UploadItem, UploadQueueProps } from "./components/inputs/UploadQueue.js";

export { Banner } from "./components/actions/Banner.js";
export type { BannerProps } from "./components/actions/Banner.js";

export { Avatar } from "./components/content/Avatar.js";
export type { AvatarProps } from "./components/content/Avatar.js";

export { Button } from "./components/actions/Button.js";
export type { ButtonProps } from "./components/actions/Button.js";

export { Checkbox } from "./components/inputs/Checkbox.js";
export type { CheckboxProps } from "./components/inputs/Checkbox.js";

export { CheckboxGroup } from "./components/inputs/CheckboxGroup.js";
export type { CheckboxGroupProps } from "./components/inputs/CheckboxGroup.js";

export { Radio, RadioGroup } from "./components/inputs/RadioGroup.js";
export type { RadioGroupProps, RadioProps } from "./components/inputs/RadioGroup.js";

export { Card } from "./components/content/Card.js";
export type { CardProps } from "./components/content/Card.js";

export { Chip } from "./components/actions/Chip.js";
export type { ChipProps } from "./components/actions/Chip.js";

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "./components/overlays/ContextMenu.js";
export type {
  ContextMenuCheckboxItemProps,
  ContextMenuContentProps,
  ContextMenuItemProps,
  ContextMenuRadioGroupProps,
  ContextMenuRadioItemProps,
} from "./components/overlays/ContextMenu.js";

export { ConfirmDialog } from "./components/overlays/ConfirmDialog.js";
export type { ConfirmDialogProps, ConfirmKind } from "./components/overlays/ConfirmDialog.js";

export { Dialog } from "./components/overlays/Dialog.js";
export type { DialogProps } from "./components/overlays/Dialog.js";

export { ShortcutsHelp } from "./components/overlays/ShortcutsHelp.js";
export type {
  ShortcutGroup,
  ShortcutItem,
  ShortcutsHelpProps,
} from "./components/overlays/ShortcutsHelp.js";

export { Form } from "./components/inputs/Form.js";
export type { FormProps } from "./components/inputs/Form.js";

export { FormField } from "./components/inputs/FormField.js";
export type { FieldLayout, FormFieldProps } from "./components/inputs/FormField.js";

export { FieldRow, FormLayout } from "./components/inputs/FormLayout.js";
export type { FieldRowProps, FormLayoutProps } from "./components/inputs/FormLayout.js";

export { Image } from "./components/content/Image.js";
export type { ImageProps } from "./components/content/Image.js";

export { InlineEdit } from "./components/inputs/InlineEdit.js";
export type { InlineEditProps } from "./components/inputs/InlineEdit.js";

export { HelpTooltip } from "./components/overlays/HelpTooltip.js";
export type { HelpTooltipProps } from "./components/overlays/HelpTooltip.js";

export { HoverCard, HoverCardContent, HoverCardTrigger } from "./components/overlays/HoverCard.js";
export type {
  HoverCardContentProps,
  HoverCardProps,
  HoverCardTriggerProps,
} from "./components/overlays/HoverCard.js";

export {
  Menu,
  MenuButton,
  MenuItem,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
  SubmenuTrigger,
} from "./components/overlays/Menu.js";
export type {
  MenuButtonProps,
  MenuItemProps,
  MenuProps,
  MenuSectionProps,
} from "./components/overlays/Menu.js";

export {
  MENU_ITEM_CLASS,
  MENU_ITEM_ICON_CLASS,
  MENU_ITEM_SHORTCUT_CLASS,
  MENU_PANEL_CLASS,
  MENU_SECTION_LABEL_CLASS,
  MENU_SEPARATOR_CLASS,
} from "./lib/menu.js";

export { ModalHeader } from "./components/overlays/ModalHeader.js";
export type { ModalHeaderProps } from "./components/overlays/ModalHeader.js";

export { ModalOverlay } from "./components/overlays/ModalOverlay.js";
export type { ModalOverlayProps } from "./components/overlays/ModalOverlay.js";

export { AppShell, useAppShell } from "./components/app-shell/AppShell.js";
export type { AppShellProps, AppShellContextValue } from "./components/app-shell/AppShell.js";

export { NavItem } from "./components/app-shell/NavItem.js";
export type { NavItemProps } from "./components/app-shell/NavItem.js";

export { MobileTabBar, MobileTabBarItem } from "./components/app-shell/MobileTabBar.js";
export type {
  MobileTabBarItemProps,
  MobileTabBarProps,
} from "./components/app-shell/MobileTabBar.js";

export { NavGroup, SideNav, useNavCollapsed } from "./components/app-shell/SideNav.js";
export type { NavGroupProps, SideNavProps } from "./components/app-shell/SideNav.js";

export { DataTable } from "./components/table/DataTable.js";
export type { DataTableProps } from "./components/table/DataTable.js";

export { FilterBar } from "./components/table/FilterBar.js";
export type { FilterBarProps } from "./components/table/FilterBar.js";

export { FilterBarAdd } from "./components/table/FilterBarAdd.js";
export type { FilterBarAddProps, FilterField } from "./components/table/FilterBarAdd.js";

export { TablePreferences } from "./components/table/TablePreferences.js";
export type {
  TablePreferencesColumn,
  TablePreferencesProps,
} from "./components/table/TablePreferences.js";

export { Toolbar } from "./components/actions/Toolbar.js";
export type { ToolbarProps } from "./components/actions/Toolbar.js";

export { TableToolbar } from "./components/table/TableToolbar.js";
export type { TableToolbarProps } from "./components/table/TableToolbar.js";

export { TopBar } from "./components/app-shell/TopBar.js";
export type { TopBarProps } from "./components/app-shell/TopBar.js";

export { MaskedInput } from "./components/inputs/MaskedInput.js";
export type { MaskedInputProps } from "./components/inputs/MaskedInput.js";

export { NumberInput } from "./components/inputs/NumberInput.js";
export type { NumberInputProps } from "./components/inputs/NumberInput.js";

export { PageHeader } from "./components/navigation/PageHeader.js";
export type { PageHeaderProps } from "./components/navigation/PageHeader.js";

export { PasswordInput } from "./components/inputs/PasswordInput.js";
export type { PasswordInputProps } from "./components/inputs/PasswordInput.js";

export { PhoneInput, RU_PHONE_MASK } from "./components/inputs/PhoneInput.js";
export type { PhoneInputProps } from "./components/inputs/PhoneInput.js";

export { PinInput } from "./components/inputs/PinInput.js";
export type { PinInputProps } from "./components/inputs/PinInput.js";

export {
  Popover,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "./components/overlays/Popover.js";
export type { PopoverContentProps } from "./components/overlays/Popover.js";

export { Calendar, NAV_BUTTON_CLASS, WEEKDAY_CELL_CLASS } from "./components/date-time/Calendar.js";
export type { CalendarProps } from "./components/date-time/Calendar.js";

export { RangeCalendar } from "./components/date-time/RangeCalendar.js";
export type { RangeCalendarProps } from "./components/date-time/RangeCalendar.js";

export { DatePicker, formatDate } from "./components/date-time/DatePicker.js";
export type { DatePickerProps } from "./components/date-time/DatePicker.js";

export { DateRangePicker } from "./components/date-time/DateRangePicker.js";
export type { DateRangePickerProps } from "./components/date-time/DateRangePicker.js";

export { TimePicker, upcomingSlots } from "./components/date-time/TimePicker.js";
export type { TimePickerProps } from "./components/date-time/TimePicker.js";

export { Timeline } from "./components/content/Timeline.js";
export type { TimelineItem, TimelineProps } from "./components/content/Timeline.js";

export { Tabs } from "./components/navigation/Tabs.js";
export type { TabItem, TabsProps } from "./components/navigation/Tabs.js";

export { EmptyState } from "./components/content/EmptyState.js";
export type { EmptyStateProps } from "./components/content/EmptyState.js";

export { ErrorState } from "./components/content/ErrorState.js";
export type { ErrorStateProps } from "./components/content/ErrorState.js";

export {
  DEFAULT_PERIOD_PRESETS,
  periodPresets,
  formatPeriodLength,
  isRelativePeriod,
  periodLength,
  RELATIVE_PERIODS,
  resolvePeriod,
} from "./lib/period.js";
export type { DateRange, PeriodPreset, RelativePeriod } from "./lib/period.js";

export { DateTimePicker, maskTime, normalizeTime } from "./components/date-time/DateTimePicker.js";
export type { DateTimePickerProps } from "./components/date-time/DateTimePicker.js";

export { Progress } from "./components/actions/Progress.js";
export type { ProgressProps } from "./components/actions/Progress.js";

export { Spinner } from "./components/actions/Spinner.js";
export type { SpinnerProps } from "./components/actions/Spinner.js";

export { Select } from "./components/inputs/Select.js";
export type { SelectId, SelectItem, SelectProps } from "./components/inputs/Select.js";

export { SelectionBar } from "./components/navigation/SelectionBar.js";
export type { SelectionBarProps } from "./components/navigation/SelectionBar.js";
export { ContextualSaveBar } from "./components/navigation/ContextualSaveBar.js";
export type { ContextualSaveBarProps } from "./components/navigation/ContextualSaveBar.js";

export { SearchControl } from "./components/inputs/SearchControl.js";
export type {
  SearchControlProps,
  SearchKeyboardConfig,
} from "./components/inputs/SearchControl.js";

export { SectionHeader } from "./components/navigation/SectionHeader.js";
export type { SectionHeaderProps } from "./components/navigation/SectionHeader.js";

export { StatusBadge } from "./components/actions/StatusBadge.js";
export type { StatusBadgeProps } from "./components/actions/StatusBadge.js";

export { Segmented } from "./components/actions/Segmented.js";
export type { SegmentedProps, SegmentedOption } from "./components/actions/Segmented.js";

export { Skeleton } from "./components/content/Skeleton.js";
export type { SkeletonProps } from "./components/content/Skeleton.js";

export { SwatchGroup } from "./components/inputs/SwatchGroup.js";
export type { SwatchGroupProps, SwatchOption } from "./components/inputs/SwatchGroup.js";

export { TextControl } from "./components/inputs/TextControl.js";
export type { TextControlProps } from "./components/inputs/TextControl.js";

export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "./components/overlays/Tooltip.js";
export type { TooltipProps } from "./components/overlays/Tooltip.js";

export { Toaster, toast } from "./components/actions/Toaster.js";
export type { ToasterProps, ToastOptions } from "./components/actions/Toaster.js";

export { Toggle } from "./components/actions/Toggle.js";
export type { ToggleProps } from "./components/actions/Toggle.js";

export { Text } from "./components/content/Text.js";
export type { TextProps, TextSize } from "./components/content/Text.js";

export { Heading } from "./components/content/Heading.js";
export type { HeadingProps, HeadingSize } from "./components/content/Heading.js";

export { Link } from "./components/content/Link.js";
export type { LinkProps, LinkVariant } from "./components/content/Link.js";

export { Separator } from "./components/content/Separator.js";
export type { SeparatorProps } from "./components/content/Separator.js";

export { ScrollArea } from "./components/content/ScrollArea.js";
export type { ScrollAreaProps } from "./components/content/ScrollArea.js";

export { AspectRatio } from "./components/content/AspectRatio.js";
export type { AspectRatioProps } from "./components/content/AspectRatio.js";

export { Carousel } from "./components/content/Carousel.js";
export type { CarouselProps, CarouselSlidesPerView } from "./components/content/Carousel.js";

export { Grid } from "./components/content/Grid.js";
export type {
  GridColumns,
  GridGap,
  GridMinItemWidth,
  GridProps,
} from "./components/content/Grid.js";

export { Kbd } from "./components/content/Kbd.js";
export type { KbdProps } from "./components/content/Kbd.js";

export { Keyboard } from "./components/content/Keyboard.js";
export type {
  KeyboardLayout,
  KeyboardProps,
  KeyboardSelection,
} from "./components/content/Keyboard.js";

export { VisuallyHidden } from "./components/content/VisuallyHidden.js";
export type { VisuallyHiddenProps } from "./components/content/VisuallyHidden.js";

export { Combobox } from "./components/inputs/Combobox.js";
export type { ComboboxProps, ComboboxItem } from "./components/inputs/Combobox.js";

export { TagInput } from "./components/inputs/TagInput.js";
export type { TagInputProps } from "./components/inputs/TagInput.js";

export { Tag, TagGroup } from "./components/content/TagGroup.js";
export type { TagGroupProps, TagKey, TagProps } from "./components/content/TagGroup.js";

export { Slider, RangeSlider } from "./components/inputs/Slider.js";
export type { SliderProps, RangeSliderProps } from "./components/inputs/Slider.js";

export { FileDropzone } from "./components/inputs/FileDropzone.js";
export type { FileDropzoneProps, RejectedFile } from "./components/inputs/FileDropzone.js";

export { Drawer } from "./components/overlays/Drawer.js";
export type { DrawerProps, DrawerSide } from "./components/overlays/Drawer.js";

export { Accordion, AccordionItem } from "./components/navigation/Accordion.js";
export type { AccordionProps, AccordionItemProps } from "./components/navigation/Accordion.js";

export { Breadcrumbs } from "./components/navigation/Breadcrumbs.js";
export type { BreadcrumbsProps, Crumb } from "./components/navigation/Breadcrumbs.js";

export { Pagination, pageRange } from "./components/navigation/Pagination.js";
export type { PaginationProps } from "./components/navigation/Pagination.js";

export { Stepper } from "./components/navigation/Stepper.js";
export type { StepperProps, Step } from "./components/navigation/Stepper.js";

export {
  MegaMenu,
  MegaMenuButton,
  MegaMenuCategory,
  MegaMenuGroup,
  MegaMenuLink,
  MegaMenuTrigger,
} from "./components/navigation/MegaMenu.js";
export type {
  MegaMenuProps,
  MegaMenuButtonProps,
  MegaMenuCategoryProps,
  MegaMenuGroupProps,
  MegaMenuLinkProps,
  MegaMenuTriggerProps,
} from "./components/navigation/MegaMenu.js";

export { ToggleGroup } from "./components/actions/ToggleGroup.js";
export type { ToggleGroupProps, ToggleGroupOption } from "./components/actions/ToggleGroup.js";

export { ButtonGroup } from "./components/actions/ButtonGroup.js";
export type { ButtonGroupProps } from "./components/actions/ButtonGroup.js";

export { SplitButton } from "./components/actions/SplitButton.js";
export type { SplitButtonProps } from "./components/actions/SplitButton.js";

export { SplitPanel } from "./components/app-shell/SplitPanel.js";
export type { SplitPanelProps } from "./components/app-shell/SplitPanel.js";

export { Transfer } from "./components/inputs/Transfer.js";
export type { TransferItem, TransferProps } from "./components/inputs/Transfer.js";

export { TreeSelect } from "./components/inputs/TreeSelect.js";
export type { TreeSelectProps } from "./components/inputs/TreeSelect.js";

export { Rating } from "./components/inputs/Rating.js";
export type { RatingProps } from "./components/inputs/Rating.js";

export { CodeView } from "./components/content/CodeView.js";
export type { CodeViewProps } from "./components/content/CodeView.js";

export { Table } from "./components/content/Table.js";
export type { TableProps, TableColumn } from "./components/content/Table.js";

export { TreeView } from "./components/navigation/TreeView.js";
export type { TreeNode, TreeViewProps } from "./components/navigation/TreeView.js";

export { Badge } from "./components/content/Badge.js";
export type { BadgeProps } from "./components/content/Badge.js";

export { Stat } from "./components/content/Stat.js";
export type { StatProps } from "./components/content/Stat.js";

export { DescriptionList } from "./components/content/DescriptionList.js";
export type {
  DescriptionListProps,
  DescriptionItem,
} from "./components/content/DescriptionList.js";

export { AvatarGroup } from "./components/content/AvatarGroup.js";
export type { AvatarGroupMember, AvatarGroupProps } from "./components/content/AvatarGroup.js";

export { CommandPalette } from "./components/overlays/CommandPalette.js";
export type {
  CommandPaletteProps,
  CommandSection,
  CommandItem,
} from "./components/overlays/CommandPalette.js";

/*
 * i18n. Появился в 2.0.0 вместе с английским фолбэком: до него каждая
 * user-visible строка была русским дефолтом пропа, и другой язык означал
 * передать подпись в каждом месте вызова.
 *
 * Каталоги локалей сюда НЕ реэкспортируются намеренно — они живут отдельными
 * входами (`@olddevs/ui/locales/ru`), иначе русский каталог оказался бы в
 * бандле у всех, включая тех, кому нужен только английский.
 */
export { UiProvider } from "./i18n/UiProvider.js";
export type { UiProviderProps } from "./i18n/UiProvider.js";
export { useMessages, useUiLocale, useUiConfig } from "./i18n/useMessages.js";
export { DEFAULT_MESSAGES, DEFAULT_LOCALE } from "./i18n/defaults.js";
export type {
  UiMessages,
  PartialUiMessages,
  CommonMessages,
  KeyboardLayoutName,
  PeriodPresetKey,
} from "./i18n/messages.js";
