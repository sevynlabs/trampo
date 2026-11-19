/**
 * TRAMPO Admin design system — import everything page-level from here:
 *   import { PageHeader, KpiCard, DataTable, StatusBadge } from "@/components/ds";
 * Primitives (Button, Input, Dialog, Select, Tabs…) stay in "@/components/ui/*".
 */
export { AppShell } from "./shell/app-shell";
export { Sidebar, SidebarItem, SidebarNav } from "./shell/sidebar";
export { Topbar } from "./shell/topbar";
export { PageHeader, type Crumb } from "./page-header";
export { KpiCard, StatCard, InfoCard, SectionCard, ChartCard, Delta, type CardTone } from "./cards";
export { AreaChart, DonutChart, HBarChart, CHART_COLORS, type SeriesPoint } from "./charts";
export { DataTable, RowActions, type ServerPagination, type ServerSorting } from "./data-table";
export { Pagination } from "./pagination";
export { SearchInput, FilterSelect, FilterBar, PeriodSelect, type FilterOption } from "./filters";
export { StatusBadge, Tag } from "./status-badge";
export { UserAvatar, UserCell, RatingStars, StarRow, initials } from "./people";
export { IconButton, ConfirmDialog, DisabledHint } from "./actions";
export { FormSection, Field, SettingRow } from "./form";
export { EmptyState, ErrorState, LoadingState } from "./states";
