"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Menu, LogOut, User, Calendar, Plus, MessageCircle, Clock, Sun, Moon } from "lucide-react";

interface NavbarProps {
  userName: string | null;
  avatarUrl: string | null;
  unreadMessageCount?: number;
}

export function Navbar({ userName, avatarUrl, unreadMessageCount = 0 }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const navLinks = [
    { href: "/sessions", label: "Find Sessions", icon: Calendar },
    { href: "/sessions/new", label: "Create Session", icon: Plus },
    { href: "/my-sessions", label: "My Sessions", icon: Calendar },
    { href: "/availability", label: "Availability", icon: Clock },
    { href: "/messages", label: "Messages", icon: MessageCircle },
  ];

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-bold text-lg">
          ShuttleMates
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
              {link.href === "/messages" && unreadMessageCount > 0 && (
                <Badge className="absolute -top-2 -right-5 h-4 min-w-4 flex items-center justify-center text-[10px] px-1">
                  {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                </Badge>
              )}
            </Link>
          ))}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Mobile nav */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64">
            <SheetTitle className="font-bold text-lg mb-6">
              ShuttleMates
            </SheetTitle>
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                  {link.href === "/messages" && unreadMessageCount > 0 && (
                    <Badge className="h-4 min-w-4 flex items-center justify-center text-[10px] px-1">
                      {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                    </Badge>
                  )}
                </Link>
              ))}
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
              <button
                onClick={() => {
                  setTheme(resolvedTheme === "dark" ? "light" : "dark");
                }}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground text-left"
              >
                <Sun className="h-4 w-4 dark:hidden" />
                <Moon className="h-4 w-4 hidden dark:block" />
                {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  handleSignOut();
                }}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground text-left"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
