import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, isStaff } from "./auth";
import { cn } from "./ui";
import Logo from "./Logo";

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
        { to: "/", label: "Overview" },
        { to: "/initiatives", label: "21 Initiatives +" },
        { to: "/schemes", label: "All Schemes" },
        { to: "/sectors", label: "Sector" },
        { to: "/departments", label: "Department" },
        { to: "/reports", label: "Reports" },
        ...(user.role === "SUPERADMIN" ? [{ to: "/admin", label: "Admin" }] : []),
      ]
    : [
        { to: "/", label: "Overview" },
        { to: "/entry", label: "Daily Data Entry" },
        { to: "/schemes", label: "My Schemes" },
        { to: "/initiatives", label: "My Initiatives" },
      ];

  async function doLogout() {
    await logout();
    navigate("/login");
  }

  const sidebarContent = (isCollapsed: boolean) => (
    <div className="flex h-full flex-col border-r border-neutral-300 bg-[#e8e9eb]">
      <div className={cn("flex items-center border-b border-neutral-300/60 py-4", isCollapsed ? "justify-center px-2" : "gap-3 px-5")}>
        <Logo size={40} className="rounded-lg" />
        {!isCollapsed && (
          <div className="leading-tight">
            <div className="text-[13px] text-neutral-900">CM INITIATIVE TRACKER</div>
            <div className="text-[11px] text-neutral-500">GoKP</div>
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
                "flex items-center rounded-lg text-[13px] transition",
                isCollapsed ? "justify-center px-0 py-3" : "px-3.5 py-2.5",
                isActive
                  ? "bg-white font-medium text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:bg-white/60 hover:text-neutral-900",
              )
            }
          >
            {isCollapsed ? n.label.replace(/^21 /, "").slice(0, 1) : n.label}
          </NavLink>
        ))}
      </nav>
      {/* Collapse toggle (desktop) */}
      <button
        onClick={toggleCollapse}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden items-center justify-center gap-2 border-t border-neutral-300/60 py-3 text-[12px] text-neutral-500 transition hover:bg-white/60 hover:text-neutral-900 lg:flex"
      >
        {isCollapsed ? "»" : "« Collapse"}
      </button>
      {!isCollapsed && (
        <div className="border-t border-neutral-300/60 px-5 py-3 text-[11px] leading-relaxed text-neutral-500">
          Chief Minister Policy Office
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
          <div className="absolute inset-0 bg-black/35" onClick={() => setOpen(false)} />
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
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 text-sm text-neutral-700">
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
