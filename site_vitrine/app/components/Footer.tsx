"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  // Hide Footer on auth pages
  if (pathname === '/register' || pathname === '/login') {
    return null;
  }

  return (
    <footer className="w-full bg-[#3C3C3C] dark:bg-zinc-950 text-gray-300 px-6 md:px-16 py-16 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">

        {/* TOP PART WITH BUTTON */}
        <div className="flex justify-center md:justify-end mb-10">
          <Link
            href="/pricing"
            className="px-6 py-3 bg-[#FF453A] text-white rounded-lg text-sm md:text-base font-medium hover:bg-[#e63c32] transition shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
          >
            Obtenir le logiciel
          </Link>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">

          {/* LEFT : LOGO */}
          <div className="flex flex-col items-center md:items-start">
            <img
              src="/assets/LogoOptigistik2-.png"
              alt="Optigistik Logo"
              className="h-36 w-auto mb-6 brightness-0 invert"
            />

            {/* Social icons */}
            <div className="flex gap-4 mt-6">
              <a
                href="#"
                target="_blank"
                className="p-3 border border-gray-500 rounded-full hover:bg-gray-700 transition"
              >
                <img src="/assets/mdi_linkedin.png" className="w-5 h-5" alt="LinkedIn" />
              </a>

              <a
                href="#"
                target="_blank"
                className="p-3 border border-gray-500 rounded-full hover:bg-gray-700 transition"
              >
                <img src="/assets/mdi_youtube.png" className="w-5 h-5" alt="YouTube" />
              </a>
            </div>
          </div>

          {/* CENTER : SITEMAP + CONTACT */}
          <div className="text-center md:text-left flex flex-col items-center md:items-start">
            <h3 className="text-white font-semibold mb-4">Sitemap</h3>

            <ul className="space-y-2 text-gray-300">
              <li><Link href="/">Accueil</Link></li>
              <li><Link href="/features">Fonctionnalités</Link></li>
              <li><Link href="/pricing">Tarifs</Link></li>
              <li><Link href="/blog">Blog</Link></li>
              <li><Link href="/contact">Nous contacter</Link></li>
            </ul>

            <hr className="border-gray-600 my-6 w-1/2" />

            <p className="text-gray-300">+33 4 87 54 34 61</p>
            <a
              href="mailto:optigistik@gmail.com"
              className="text-gray-300 underline"
            >
              optigistik@gmail.com
            </a>
          </div>

          {/* RIGHT : LEGAL + COPYRIGHT */}
          <div className="flex flex-col justify-between text-sm h-full items-center md:items-end text-center md:text-right">

            <div className="flex flex-col items-center md:items-end gap-2 text-gray-400 text-sm">
              <div className="flex gap-4">
                <Link href="/legal" className="hover:text-white transition">Mentions légales</Link>
                <Link href="/cgv" className="hover:text-white transition">CGV</Link>
              </div>
              <div className="flex gap-4">
                <Link href="/confidentialite" className="hover:text-white transition">Confidentialité</Link>
                <Link href="/cookies" className="hover:text-white transition">Cookies</Link>
              </div>
            </div>

            <div className="text-gray-500 dark:text-gray-400 mt-10">
              © 2025 — Optigistik
              <br />
              All Rights Reserved
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}