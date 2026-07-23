import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, isStaff } from "./auth";
import { cn } from "./ui";
import Logo from "./Logo";

const I = {
  dash: "M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-18v6h8V3h-8z",
  target: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 5a5 5 0 100 10 5 5 0 000-10zm0 3.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z",
  sheet: "M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zm1 5v3h6V8H5zm8 0v3h6V8h-6zm-8 5v3h6v-3H5zm8 0v3h6v-3h-6z",
  building: "M4 21V5l8-3v19M12 21h8V9l-8-3M7 9h.01M7 13h.01M7 17h.01M16 12h.01M16 16h.01",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  mail: "M3 5h18a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1zm0 2l9 6 9-6",
  gear: "M12 8a4 4 0 100 8 4 4 0 000-8zm8.94 3a8.96 8.96 0 00-.9-2.17l1.45-1.45-2.87-2.87-1.45 1.45c-.68-.4-1.4-.7-2.17-.9V3h-4v2.06c-.77.2-1.5.5-2.17.9L7.38 4.51 4.51 7.38l1.45 1.45c-.4.68-.7 1.4-.9 2.17H3v4h2.06c.2.77.5 1.5.9 2.17l-1.45 1.45 2.87 2.87 1.45-1.45c.68.4 1.4.7 2.17.9V21h4v-2.06c.77-.2 1.5-.5 2.17-.9l1.45 1.45 2.87-2.87-1.45-1.45c.4-.68.7-1.4.9-2.17H21v-4h-2.06z",
};

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("cmit.sidebar") === "1");
  if (!user) return null;
  const staff = isStaff(user);

  function toggleCollapse() {
    setCollapsed((c) => {
      localStorage.setItem("cmit.sidebar", c ? "0" : "1");
      return !c;
    });
  }

  const nav = staff
    ? [
        { to: "/", label: "Dashboard", d: I.dash },
        { to: "/initiatives", label: "21 Initiatives", d: I.target },
        { to: "/departments", label: "Departments / Sectors", d: I.building },
        { to: "/schemes", label: "All Schemes", d: I.list },
        { to: "/reports", label: "Reports & Digest", d: I.mail },
        ...(user.role === "SUPERADMIN" ? [{ to: "/admin", label: "Admin", d: I.gear }] : []),
      ]
    : [
        { to: "/", label: "Dashboard", d: I.dash },
        { to: "/entry", label: "Daily Data Entry", d: I.sheet },
        { to: "/schemes", label: "My Schemes", d: I.list },
        { to: "/initiatives", label: "My Initiatives", d: I.target },
      ];

  async function doLogout() {
    await logout();
    navigate("/login");
  }

  const sidebarContent = (isCollapsed: boolean) => (
    <div className="flex h-full flex-col bg-navy-900">
      <div className={cn("flex items-center border-b border-white/10 py-4", isCollapsed ? "justify-center px-2" : "gap-3 px-5")}>
        <Logo size={40} className="rounded-lg" />
        {!isCollapsed && (
          <div className="leading-tight">
            <div className="text-[13px] font-bold text-white">CM INITIATIVE TRACKER</div>
            <div className="text-[11px] text-white/50">GoKP</div>
          </div>
        )}
      </div>
      <nav className={cn("scroll-thin flex-1 space-y-0.5 overflow-y-auto py-4", isCollapsed ? "px-2" : "px-3")}>
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            title={n.label}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-lg text-[13px] font-medium transition",
                isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-2.5",
                isActive ? "bg-white text-navy-900" : "text-white/70 hover:bg-white/10 hover:text-white",
              )
            }
          >
            <Icon d={n.d} className="h-[18px] w-[18px] shrink-0" />
            {!isCollapsed && n.label}
          </NavLink>
        ))}
      </nav>
      {/* Collapse toggle (desktop) */}
      <button
        onClick={toggleCollapse}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden items-center justify-center gap-2 border-t border-white/10 py-3 text-[12px] font-medium text-white/60 transition hover:bg-white/10 hover:text-white lg:flex"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("h-4 w-4 transition-transform", isCollapsed && "rotate-180")}>
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {!isCollapsed && "Collapse"}
      </button>
      {!isCollapsed && (
        <div className="border-t border-white/10 px-5 py-3 text-[11px] leading-relaxed text-white/40">
          Chief Minister&apos;s Policy Office
          <br />
          CMPO · Daily Progress Tracking
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden transition-all lg:block", collapsed ? "w-[72px]" : "w-64")}>
        {sidebarContent(collapsed)}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebarContent(false)}</aside>
        </div>
      )}

      <div className={cn("transition-all", collapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
            <div className="hidden text-sm text-slate-500 sm:block">
              {user.departmentName ? (
                <>
                  <span className="font-semibold text-navy-800">{user.departmentName}</span>
                  <span className="ml-2 rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-semibold text-navy-700">
                    {user.username.toUpperCase()}
                  </span>
                </>
              ) : (
                "Chief Minister's Priority Tracking Platform"
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-[13px] font-semibold text-navy-900">{user.name}</div>
              <div className="text-[11px] text-slate-500">
                {user.role === "SUPERADMIN" ? "Super Admin" : user.role === "ADMIN" ? "Admin" : "Department User"}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <button onClick={doLogout} className="btn-ghost px-3 py-1.5 text-xs">
              Sign out
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
          <Outlet />
        </main>
        <footer className="px-6 pb-8 pt-2 text-center text-[11px] text-slate-400">
          CM Initiative Tracker · Data collection &amp; visualization platform · Government of Khyber Pakhtunkhwa
        </footer>
      </div>
    </div>
  );
}
