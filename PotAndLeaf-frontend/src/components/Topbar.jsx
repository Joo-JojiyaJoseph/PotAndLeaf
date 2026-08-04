import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  UserCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

export default function Topbar({ onMenu }) {
  const { user, activeCompany, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur">
      <button
        onClick={onMenu}
        className="rounded-[10px] p-1.5 text-muted hover:bg-paper hover:text-ink lg:hidden"
        aria-label="Open menu"
      >
        <Bars3Icon className="size-5" />
      </button>

      <div className="relative hidden max-w-sm flex-1 sm:block">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          placeholder="Search products, suppliers, bills…"
          className="h-9 w-full rounded-[10px] border border-line bg-paper pl-9 pr-3 text-sm placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {activeCompany && (
          <span className="hidden font-mono text-xs text-muted sm:inline">
            {activeCompany.name}
          </span>
        )}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex size-8 items-center justify-center rounded-full bg-leaf-soft text-xs font-semibold text-leaf"
          >
            {initials}
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-line bg-surface py-1 shadow-lg">
              <div className="border-b border-line px-3 py-2">
                <div className="truncate text-sm font-medium">{user?.name}</div>
                <div className="truncate text-xs text-muted">{user?.email}</div>
              </div>
              <Link
                to="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted hover:bg-paper hover:text-ink"
              >
                <UserCircleIcon className="size-4" />
                My profile
              </Link>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted hover:bg-paper hover:text-ink"
              >
                <ArrowRightStartOnRectangleIcon className="size-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
