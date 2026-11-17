"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { LogOut, ArrowRight, LayoutDashboard, Bell, Menu, X } from "lucide-react";

export function Navbar() {
  const { user, logout, loading } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 bg-white/95 backdrop-blur-md transition-all duration-200 border-b ${
        isScrolled ? "border-[#D9E2EC] shadow-subtle py-2" : "border-[#D9E2EC]/80 py-3"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Brand Identity */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="rounded-lg transition-transform group-hover:scale-[1.02] flex items-center gap-2.5">
              <Image
                src="/logo-icon.png"
                alt="Scale-up India"
                width={40}
                height={40}
                className="h-10 w-auto"
                priority
              />
              <span className="text-base font-extrabold text-[#0B1F3A] tracking-tight">Scale-up India</span>
            </div>
            <div className="hidden lg:block border-l border-[#D9E2EC] pl-3 py-0.5">
              <span className="text-[10px] uppercase tracking-wider text-[#667085] font-semibold block leading-tight">
                An Initiative of
              </span>
              <span className="text-xs font-bold text-[#0B1F3A] block leading-tight">
                Ideal Corporate Synergy LLP
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#344054]">
            <Link
              href="/"
              className="hover:text-[#1557A6] transition-colors relative py-1 hover:after:w-full after:transition-all after:duration-200 after:h-0.5 after:bg-[#1557A6] after:absolute after:bottom-0 after:left-0 after:w-0"
            >
              Home
            </Link>
            <Link
              href="/how-it-works"
              className="hover:text-[#1557A6] transition-colors relative py-1 hover:after:w-full after:transition-all after:duration-200 after:h-0.5 after:bg-[#1557A6] after:absolute after:bottom-0 after:left-0 after:w-0"
            >
              How It Works
            </Link>
            <Link
              href="/opportunities"
              className="hover:text-[#1557A6] transition-colors relative py-1 hover:after:w-full after:transition-all after:duration-200 after:h-0.5 after:bg-[#1557A6] after:absolute after:bottom-0 after:left-0 after:w-0"
            >
              Opportunities
            </Link>
            <Link
              href="/services"
              className="hover:text-[#1557A6] transition-colors relative py-1 hover:after:w-full after:transition-all after:duration-200 after:h-0.5 after:bg-[#1557A6] after:absolute after:bottom-0 after:left-0 after:w-0"
            >
              Advisory & DD
            </Link>
            <Link
              href="/about"
              className="hover:text-[#1557A6] transition-colors relative py-1 hover:after:w-full after:transition-all after:duration-200 after:h-0.5 after:bg-[#1557A6] after:absolute after:bottom-0 after:left-0 after:w-0"
            >
              About ICS
            </Link>
          </nav>

          {/* User Auth CTA States */}
          <div className="hidden sm:flex items-center gap-3">
            {loading ? (
              <div className="h-9 w-24 bg-[#EEF5FB] animate-pulse rounded-lg" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 bg-[#1557A6] hover:bg-[#2878C8] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-all duration-200"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  href="/notifications"
                  title="Notifications"
                  className="relative p-2 text-[#344054] hover:text-[#1557A6] hover:bg-[#EEF5FB] rounded-lg transition-colors"
                >
                  <Bell className="w-4 h-4" />
                </Link>
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-[#0B1F3A]">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="text-[10px] text-[#667085] font-mono">
                    {user.roles.join(", ")}
                  </span>
                </div>
                <button
                  onClick={() => logout()}
                  title="Logout"
                  className="p-2 text-[#667085] hover:text-[#D92D20] hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link
                  href="/login"
                  className="text-[#0B1F3A] hover:text-[#1557A6] hover:bg-[#EEF5FB] text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="flex items-center gap-1.5 bg-[#1557A6] hover:bg-[#2878C8] text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-all duration-200 hover:shadow"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[#344054] hover:bg-[#EEF5FB]"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden pt-4 pb-3 border-t border-[#D9E2EC] space-y-3">
            <div className="flex flex-col gap-2 font-medium text-sm text-[#344054]">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-[#EEF5FB] hover:text-[#1557A6]"
              >
                Home
              </Link>
              <Link
                href="/how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-[#EEF5FB] hover:text-[#1557A6]"
              >
                How It Works
              </Link>
              <Link
                href="/opportunities"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-[#EEF5FB] hover:text-[#1557A6]"
              >
                Opportunities
              </Link>
              <Link
                href="/services"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-[#EEF5FB] hover:text-[#1557A6]"
              >
                Advisory & DD
              </Link>
              <Link
                href="/about"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-[#EEF5FB] hover:text-[#1557A6]"
              >
                About ICS
              </Link>
            </div>
            <div className="pt-2 border-t border-[#D9E2EC] flex flex-col gap-2">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2 bg-[#1557A6] text-white rounded-lg text-xs font-bold"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-center py-2 text-[#D92D20] text-xs font-semibold"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2 border border-[#D9E2EC] text-[#0B1F3A] rounded-lg text-xs font-semibold"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2 bg-[#1557A6] text-white rounded-lg text-xs font-bold"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
