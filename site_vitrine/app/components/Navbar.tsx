"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { isAdmin } from "../lib/adminUtils";

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const adminStatus = await isAdmin();
        setIsAdminUser(adminStatus);
      } else {
        setIsAdminUser(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    await signOut(auth);
    setShowLogoutModal(false);
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  const navItems = [
    { label: "Accueil", href: "/" },
    { label: "Fonctionnalités", href: "/features" },
    { label: "Tarifications", href: "/pricing" },
    { label: "Blog", href: "/blog" },
    { label: "Nous contacter", href: "/contact" },
  ];

  const handleLinkClick = () => setIsOpen(false);

  // Hide Navbar on auth pages
  if (pathname === '/register' || pathname === '/login') {
    return null;
  }

  return (
    <>
      <nav className="w-full bg-white dark:bg-zinc-950 shadow-sm fixed top-0 left-0 z-50 px-6 md:px-16 transition-all duration-300 border-b border-transparent dark:border-zinc-900">
        <div className="max-w-7xl mx-auto py-4 flex items-center justify-between">

          {/* LEFT: LOGO */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2">
              <img
                src="/assets/LogoOptigistik2.png"
                alt="Optigistik logo"
                className="h-12 md:h-16 w-auto dark:brightness-0 dark:invert"
              />
            </Link>
          </div>

          {/* CENTER: NAV LINKS */}
          <div className="hidden lg:flex items-center justify-center flex-1 px-8">
            <div className="flex items-center gap-8">
              {navItems.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm font-medium relative group transition-colors ${isActive ? "text-[#0C1D36] dark:text-white" : "text-gray-600 dark:text-gray-300 hover:text-[#0C1D36] dark:hover:text-white"
                      }`}
                  >
                    {item.label}
                    <span className={`absolute -bottom-1 left-0 w-full h-0.5 bg-[#FF453A] transform origin-left transition-transform duration-300 ${isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                      }`}></span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* RIGHT: ACTIONS (CTA + LOGIN/AVATAR) */}
          <div className="hidden lg:flex items-center gap-6 flex-shrink-0">
            {!user ? (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-600 hover:text-[#0C1D36] transition"
                >
                  Se connecter
                </Link>
                <Link
                  href="/pricing"
                  className="px-6 py-3 bg-[#FF453A] text-white rounded-lg text-sm md:text-base font-medium hover:bg-[#e63d32] transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                >
                  Obtenir le logiciel
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <button
                    className="w-10 h-10 rounded-full bg-[#0C1D36] text-white flex items-center justify-center font-bold text-lg hover:bg-[#1a2e4d] transition shadow-sm ring-2 ring-transparent hover:ring-[#FF453A]/20"
                    title={`Connecté en tant que ${user.email}`}
                  >
                    {user.email?.charAt(0).toUpperCase()}
                  </button>

                  {/* Dropdown for Logout */}
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right z-50">
                    <div className="p-2">
                      <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 mb-1 truncate">
                        {user.email}
                      </div>
                      {isAdminUser && (
                        <Link
                          href="/admin"
                          className="w-full text-left px-3 py-2 text-sm text-[#0C1D36] hover:bg-gray-50 rounded-lg transition flex items-center gap-2"
                        >
                          Dashboard Admin
                        </Link>
                      )}
                      <button
                        onClick={handleLogoutClick}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        Déconnexion
                      </button>
                    </div>
                  </div>
                </div>

                <Link
                  href="/pricing"
                  className="px-6 py-3 bg-[#FF453A] text-white rounded-lg text-sm md:text-base font-medium hover:bg-[#e63d32] transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                >
                  Obtenir le logiciel
                </Link>
              </div>
            )}
          </div>

          {/* MOBILE BURGER BUTTON */}
          <button
            className="lg:hidden flex flex-col gap-1.5"
            onClick={() => setIsOpen(!isOpen)}
          >
            <span className={`h-1 w-7 bg-black rounded transition ${isOpen ? "rotate-45 translate-y-2" : ""}`}></span>
            <span className={`h-1 w-7 bg-black rounded transition ${isOpen ? "opacity-0" : ""}`}></span>
            <span className={`h-1 w-7 bg-black rounded transition ${isOpen ? "-rotate-45 -translate-y-2" : ""}`}></span>
          </button>

          {/* MOBILE MENU */}
          {isOpen && (
            <div className="absolute top-full left-0 w-full bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t dark:border-zinc-900 shadow-lg flex flex-col p-6 lg:hidden h-[calc(100vh-80px)] overflow-y-auto">
              {navItems.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleLinkClick}
                    className={`text-lg font-medium py-4 border-b border-gray-100 dark:border-zinc-800
                    ${isActive
                        ? "text-[#0C1D36] dark:text-white"
                        : "text-gray-600 dark:text-gray-300"
                      }
                  `}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <div className="mt-auto pt-8 flex flex-col gap-4">
                {!user ? (
                  <>
                    <Link
                      href="/login"
                      onClick={handleLinkClick}
                      className="w-full py-3 text-center text-gray-700 dark:text-white font-medium border border-gray-200 dark:border-zinc-700 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition"
                    >
                      Se connecter
                    </Link>
                    <Link
                      href="/pricing"
                      onClick={handleLinkClick}
                      className="w-full py-3 bg-[#FF453A] text-white rounded-xl font-medium hover:bg-[#e53e32] transition text-center shadow-lg"
                    >
                      Obtenir le logiciel
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 px-2 py-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-[#0C1D36] dark:bg-zinc-700 text-white flex items-center justify-center font-bold text-lg">
                        {user.email?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.email}</p>
                        {isAdminUser && (
                          <Link
                            href="/admin"
                            onClick={handleLinkClick}
                            className="text-xs text-[#0C1D36] dark:text-white font-medium hover:underline"
                          >
                            Dashboard Admin
                          </Link>
                        )}
                        <button
                          onClick={() => {
                            handleLinkClick();
                            handleLogoutClick();
                          }}
                          className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium"
                        >
                          Se déconnecter
                        </button>
                      </div>
                    </div>
                    <Link
                      href="/pricing"
                      onClick={handleLinkClick}
                      className="w-full py-3 bg-[#FF453A] text-white rounded-xl font-medium hover:bg-[#e53e32] transition text-center shadow-lg"
                    >
                      Obtenir le logiciel
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 transform transition-all scale-100">
            <h3 className="text-xl font-archivoBlack text-[#0C1D36] mb-4 text-center">
              Se déconnecter ?
            </h3>
            <p className="text-gray-600 text-center mb-8">
              Êtes-vous sûr de vouloir vous déconnecter de votre compte ?
            </p>
            <div className="flex gap-4">
              <button
                onClick={cancelLogout}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 px-4 py-2 bg-[#FF453A] text-white rounded-lg font-medium hover:bg-[#e53e32] transition"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}