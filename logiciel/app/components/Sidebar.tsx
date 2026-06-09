"use client";

import { Home, Truck, Map as MapIcon, Users, Menu, LogOut, ShieldCheck, MessageSquare } from "lucide-react";
import { User } from "firebase/auth";
import Link from "next/link";
import RoleGuard from "./RoleGuard";
import { usePathname } from "next/navigation";
import { UserProfile } from "../context/AuthContext";
import { useMessaging } from "../context/MessagingContext";

interface SidebarProps {
  user: User | null;
  profile: UserProfile | null;
  onLogout: () => void;
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export default function Sidebar({ user, profile, onLogout, isCollapsed, toggleSidebar }: SidebarProps) {
  const pathname = usePathname();
  const userRole = profile?.role;
  const { totalUnread } = useMessaging();

  // `allowedRoles` aligne la nav sur la matrice de permissions (cf. firestore.rules / RoleGuard).
  const menuItems = [
    { name: "Accueil", icon: Home, href: "/", allowedRoles: ["Admin", "Gestionnaire", "Lecteur", "Chauffeur"] },
    { name: "Conducteurs & Flotte", icon: Truck, href: "/conducteurs-flotte", allowedRoles: ["Admin", "Gestionnaire", "Lecteur"] },
    { name: "Tournées & Abonnements", icon: MapIcon, href: "/tournees", allowedRoles: ["Admin", "Gestionnaire", "Lecteur", "Chauffeur"] },
    { name: "Gestion des clients", icon: Users, href: "/clients", allowedRoles: ["Admin", "Gestionnaire"] },
  ];

  const visibleMenuItems = menuItems.filter((item) =>
    item.allowedRoles.some((role) => role.toLowerCase() === userRole?.toLowerCase())
  );

  return (
    <aside
      className={`bg-white text-opti-blue flex flex-col h-screen sticky top-0 shrink-0 z-20 transition-all duration-300 ease-in-out font-sans ${
        isCollapsed ? "w-20" : "w-72"
      } py-6 pl-4`}
    >
      <div className="flex items-center mb-10">
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-gray-100 rounded-lg text-opti-blue transition-colors cursor-pointer"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 space-y-4">
        {visibleMenuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`w-full flex items-center gap-4 py-3 px-4 rounded-l-full transition-all group relative ${
                isActive
                  ? "bg-red-50 text-opti-red font-bold"
                  : "text-opti-blue hover:bg-gray-50 hover:text-opti-red font-semibold"
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-opti-red" : "text-opti-blue"}`} />
              {!isCollapsed && <span className="text-sm truncate">{item.name}</span>}
            </Link>
          );
        })}

        {/* Messagerie : accessible à tous les rôles */}
        <Link
          href="/messagerie"
          className={`w-full flex items-center gap-4 py-3 px-4 rounded-l-full transition-all group relative ${
            pathname === "/messagerie"
              ? "bg-red-50 text-opti-red font-bold"
              : "text-opti-blue hover:bg-gray-50 hover:text-opti-red font-semibold"
          }`}
        >
          <div className="relative shrink-0">
            <MessageSquare className={`w-5 h-5 ${pathname === "/messagerie" ? "text-opti-red" : "text-opti-blue"}`} />
            {totalUnread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-opti-red text-white text-[9px] font-bold flex items-center justify-center">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </div>
          {!isCollapsed && <span className="text-sm truncate">Messagerie</span>}
        </Link>

        {/* Lien réservé à l'Admin. fallback={null} pour masquer silencieusement (pas d'écran AccessDenied dans la nav). */}
        <RoleGuard allowedRoles={["Admin"]} fallback={null}>
          <Link
            href="/admin/roles"
            className={`w-full flex items-center gap-4 py-3 px-4 rounded-l-full transition-all group relative ${
              pathname === "/admin/roles"
                ? "bg-red-50 text-opti-red font-bold"
                : "text-opti-blue hover:bg-gray-50 hover:text-opti-red font-semibold"
            }`}
          >
            <ShieldCheck className={`w-5 h-5 shrink-0 ${pathname === "/admin/roles" ? "text-opti-red" : "text-opti-blue"}`} />
            {!isCollapsed && <span className="text-sm truncate">Gestion du personnel</span>}
          </Link>
        </RoleGuard>
      </nav>

      <div className="pr-4 mt-auto">
        <div className="flex items-center gap-3 p-3 rounded-2xl border border-gray-200 shadow-sm bg-white">
          <div className="w-10 h-10 rounded-full bg-opti-red flex items-center justify-center text-white font-bold shrink-0">
            {profile?.name ? profile.name.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'U')}
          </div>

          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-opti-blue truncate">
                  {profile?.name || user?.email?.split('@')[0] || "Utilisateur"}
                </p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">
                  {profile?.role || "Lecteur"}
                </p>
              </div>
              <button
                onClick={onLogout}
                className="p-2 text-gray-500 hover:text-opti-red hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}