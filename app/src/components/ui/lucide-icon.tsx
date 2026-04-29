import React from 'react';
import {
	Activity,
	AlertTriangle,
	ArrowDownToLine,
	ArrowRight,
	ArrowUpDown,
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Circle,
	Copy,
	Download,
	Edit3,
	FileJson,
	Filter,
	FlaskConical,
	History,
	Hourglass,
	Image as ImageIcon,
	ImageOff,
	Info,
	Keyboard,
	LayoutDashboard,
	Play,
	Plus,
	RefreshCw,
	RotateCcw,
	Save,
	Search,
	Settings as SettingsIcon,
	StopCircle,
	AppWindow as TabIcon,
	Trash2,
	Upload,
	X,
	XCircle,
	Zap,
	ZoomIn,
	ZoomOut,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS = {
	activity: Activity,
	'alert-triangle': AlertTriangle,
	'arrow-down-to-line': ArrowDownToLine,
	'arrow-right': ArrowRight,
	'arrow-up-down': ArrowUpDown,
	check: Check,
	'check-circle': CheckCircle2,
	'chevron-down': ChevronDown,
	'chevron-left': ChevronLeft,
	'chevron-right': ChevronRight,
	'chevrons-left': ChevronsLeft,
	'chevrons-right': ChevronsRight,
	circle: Circle,
	copy: Copy,
	download: Download,
	edit: Edit3,
	'file-json': FileJson,
	filter: Filter,
	flask: FlaskConical,
	history: History,
	hourglass: Hourglass,
	image: ImageIcon,
	'image-off': ImageOff,
	info: Info,
	keyboard: Keyboard,
	layout: LayoutDashboard,
	play: Play,
	plus: Plus,
	refresh: RefreshCw,
	'rotate-ccw': RotateCcw,
	save: Save,
	search: Search,
	settings: SettingsIcon,
	stop: StopCircle,
	tab: TabIcon,
	trash: Trash2,
	upload: Upload,
	x: X,
	'x-circle': XCircle,
	zap: Zap,
	'zoom-in': ZoomIn,
	'zoom-out': ZoomOut,
} as const;

export type LucideIconName = keyof typeof ICONS;

export interface LucideIconProps extends Omit<LucideProps, 'ref'> {
	name: LucideIconName;
}

export function LucideIcon({ name, className, ...props }: LucideIconProps) {
	const Component = ICONS[name];
	if (!Component) {
		throw new Error(`LucideIcon: ícone "${String(name)}" não está registrado`);
	}
	return <Component className={cn(className)} aria-hidden="true" {...props} />;
}
