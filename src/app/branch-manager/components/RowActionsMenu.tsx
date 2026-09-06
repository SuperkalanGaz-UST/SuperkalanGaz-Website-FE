import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from '../../components/ui/dropdown-menu';

/** Ghost icon-sm Button's computed style, inlined here because the Radix
 * DropdownMenuTrigger renders its own <button> (no ref-forwarding `asChild`
 * target available on the hand-rolled Button component) — kept visually
 * identical to every other icon-only button in these tables. */
const menuTriggerStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '1.75rem', height: '1.75rem', padding: '0.25rem', borderRadius: '0.375rem',
    border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'inherit', cursor: 'pointer',
};

/** A row's secondary actions (2+) collapse into this kebab menu instead of a
 * row of buttons — the single most important action stays a visible Button
 * beside it. Radix portals the menu content to the document body, so it
 * isn't clipped by a table's own `overflow-x: auto` wrapper. */
export function RowActionsMenu({ items }: { items: { label: string; onClick: () => void }[] }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger style={menuTriggerStyle} aria-label="More actions">
                <MoreHorizontal size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {items.map((item) => (
                    <DropdownMenuItem key={item.label} onSelect={() => item.onClick()}>
                        {item.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
