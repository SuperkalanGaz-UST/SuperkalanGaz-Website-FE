import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
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
export function RowActionsMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean; icon?: React.ReactNode }[] }) {
    const normalItems = items.filter(i => !i.danger);
    const dangerItems = items.filter(i => i.danger);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger style={menuTriggerStyle} aria-label="More actions">
                <MoreHorizontal size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ minWidth: '160px' }}>
                {normalItems.map((item) => (
                    <DropdownMenuItem 
                        key={item.label} 
                        onSelect={() => item.onClick()}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.75rem', cursor: 'pointer' }}
                    >
                        {item.icon && <span style={{ opacity: 0.7, display: 'flex', alignItems: 'center' }}>{item.icon}</span>}
                        <span>{item.label}</span>
                    </DropdownMenuItem>
                ))}
                
                {normalItems.length > 0 && dangerItems.length > 0 && <DropdownMenuSeparator />}
                
                {dangerItems.map((item) => (
                    <DropdownMenuItem 
                        key={item.label} 
                        variant="destructive"
                        onSelect={() => item.onClick()}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.75rem', cursor: 'pointer' }}
                    >
                        {item.icon && <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>}
                        <span>{item.label}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
