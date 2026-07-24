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
        { to: "/prp", label: "Peshawar Revitalization" },
        { to: "/sectors", label: "Sector" },
        { to: "/departments", label: "Department" },
        { to: "/implementation", label: "Implementation" },
        { to: "/reports", label: "Reports" },
        ...(user.role === "SUPERADMIN" ? [{ to: "/admin", label: "Admin" }] : []),
      ]
    : [
        { to: "/", label: "Overview" },
        { to: "/entry", label: "Weekly Data Entry" },
        { to: "/schemes", label: "My Schemes" },
        { to: "/initiatives", label: "My Initiatives" },
      ];

  async function doLogout() {
    await logout();
    navigate("/login");
  }

  const sidebarContent = (isCollapsed: boolean) => (
    <div className="flex h-full flex-col border-r border-white/10 bg-white/[0.05] backdrop-blur-2xl">
      <div className={cn("flex items-center border-b border-white/10 py-4", isCollapsed ? "justify-center px-2" : "gap-3 px-5")}>
        <Logo size={40} className="rounded-lg" />
        {!isCollapsed && (
          <div className="leading-tight">
            <div className="text-[13px] text-white/90">CM INITIATIVE TRACKER</div>
            <div className="text-[11px] text-white/45">GoKP</div>
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
                  ? "bg-white/15 font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12)]"
                  : "text-white/55 hover:bg-white/[0.08] hover:text-white",
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
        className="hidden items-center justify-center gap-2 border-t border-white/10 py-3 text-[12px] text-white/40 transition hover:bg-white/[0.08] hover:text-white lg:flex"
      >
        {isCollapsed ? "»" : "« Collapse"}
      </button>
      {!isCollapsed && (
        <div className="border-t border-white/10 px-5 py-3 text-[11px] leading-relaxed text-white/40">
          Chief Minister Policy Office
          <br />
          CMPO · Weekly Progress Tracking
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
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebarContent(false)}</aside>
        </div>
      )}

      <div className={cn("transition-all", collapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-black/20 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-white/60 hover:bg-white/10 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
            <div className="hidden text-sm text-white/50 sm:block">
              {user.departmentName ? (
                <>
                  <span className="font-semibold text-white/90">{user.departmentName}</span>
                  <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/70">
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
              <div className="text-[13px] font-semibold text-white/90">{user.name}</div>
              <div className="text-[11px] text-white/45">
                {user.role === "SUPERADMIN" ? "Super Admin" : user.role === "ADMIN" ? "Admin" : "Department User"}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm text-white/80">
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
        <footer className="px-6 pb-8 pt-2 text-center text-[11px] text-white/25">
          CM Initiative Tracker · Data collection &amp; visualization platform · Government of Khyber Pakhtunkhwa
        </footer>
      </div>
    </div>
  );
}
