import { redirect } from "next/navigation";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Users,
  Calendar,
  MapPin,
  Heart,
  Zap,
  Target,
  Activity,
  Trophy,
  Star,
  ArrowRight,
  MessageCircle,
  Shield,
} from "lucide-react";

const steps = [
  {
    num: "01",
    icon: Calendar,
    title: "Create a Session",
    desc: "Pick your date, time, venue, and skill level. Set how many players you need and publish your session in seconds.",
  },
  {
    num: "02",
    icon: Users,
    title: "Find Your Players",
    desc: "Browse open sessions near you or let players discover yours. Filter by skill level, game type, and location.",
  },
  {
    num: "03",
    icon: MapPin,
    title: "Show Up & Play",
    desc: "Meet at the court, play your game, and grow your badminton network. Chat with teammates before and after.",
  },
];

const benefits = [
  {
    icon: Activity,
    title: "Full-Body Workout",
    desc: "Burn up to 450 calories per hour while having fun. Badminton works your legs, core, arms, and cardiovascular system.",
  },
  {
    icon: Heart,
    title: "Social & Community",
    desc: "Meet like-minded people who share your passion. Build lasting friendships through regular games and sessions.",
  },
  {
    icon: Zap,
    title: "Sharpens Reflexes",
    desc: "Improve your reaction time, hand-eye coordination, and agility. The shuttlecock can travel over 200 mph in pro games.",
  },
  {
    icon: Shield,
    title: "All Skill Levels",
    desc: "Whether you're picking up a racket for the first time or competing at club level, there's a game for everyone.",
  },
];

const testimonials = [
  {
    quote:
      "I moved to a new city and had no one to play with. ShuttleMates helped me find a weekly doubles group within a week!",
    name: "Ashan Perera",
    role: "Intermediate Player",
    rating: 5,
  },
  {
    quote:
      "The session chat feature is a game changer. We coordinate everything — from court bookings to post-game drinks.",
    name: "Nimesha Fernando",
    role: "Session Organizer",
    rating: 5,
  },
  {
    quote:
      "As a beginner, I was nervous about joining. But the skill-level filtering made it easy to find welcoming sessions.",
    name: "Kavindu Silva",
    role: "Beginner Player",
    rating: 5,
  },
];

const features = [
  {
    icon: Calendar,
    title: "Session Management",
    desc: "Create, browse, and join sessions with full control over dates, venues, and player limits.",
  },
  {
    icon: MessageCircle,
    title: "Built-in Chat",
    desc: "Group chat within sessions and direct messaging between players. Coordinate everything in one place.",
  },
  {
    icon: Target,
    title: "Skill Matching",
    desc: "Filter by Beginner, Intermediate, or Advanced. Find games that match your level.",
  },
  {
    icon: Users,
    title: "Player Profiles",
    desc: "See who you're playing with. View skill levels, locations, and connect with your badminton community.",
  },
  {
    icon: Trophy,
    title: "Singles & Doubles",
    desc: "Looking for a competitive singles match or a fun doubles game? Filter by game type to find the right fit.",
  },
  {
    icon: MapPin,
    title: "Local Discovery",
    desc: "Find sessions in your city. Never miss a game happening near your favorite courts.",
  },
];

const getLandingStats = unstable_cache(
  async () => {
    const admin = createAdminClient();
    const [
      { count: playerCount },
      { count: sessionCount },
      { data: cityData },
    ] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("sessions").select("*", { count: "exact", head: true }),
      admin.from("sessions").select("city").not("city", "is", null),
    ]);

    return {
      playerCount: playerCount ?? 0,
      sessionCount: sessionCount ?? 0,
      uniqueCities: new Set(cityData?.map((s) => s.city) ?? []).size,
    };
  },
  ["landing-stats"],
  { revalidate: 3600 }
);

export default async function LandingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  const { playerCount, sessionCount, uniqueCities } = await getLandingStats();

  const stats = [
    { value: playerCount ?? 0, label: "Active Players" },
    { value: sessionCount ?? 0, label: "Sessions Created" },
    { value: uniqueCities, label: "Cities" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <span className="font-bold text-lg">ShuttleMates</span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex-1 flex items-center justify-center py-24 sm:py-32 px-4 overflow-hidden">
        {/* Background layer */}
        <div className="absolute inset-0 -z-10">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-background to-emerald-50/80 dark:from-green-950/40 dark:via-background dark:to-emerald-950/30" />

          {/* Dot grid pattern */}
          <div className="absolute inset-0 hero-grid text-foreground/[0.04] dark:text-foreground/[0.06]" />

          {/* Large glowing orbs */}
          <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-green-400/20 dark:bg-green-500/15 rounded-full blur-[100px] animate-glow-pulse" />
          <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-emerald-400/20 dark:bg-emerald-500/10 rounded-full blur-[120px] animate-glow-pulse [animation-delay:2s]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-teal-300/10 dark:bg-teal-500/10 rounded-full blur-[80px] animate-drift" />

          {/* Floating shuttlecock illustrations */}
          <svg className="absolute top-[12%] left-[8%] w-16 h-16 text-green-500/20 dark:text-green-400/15 animate-float" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
            <ellipse cx="32" cy="48" rx="10" ry="10" fill="currentColor" opacity="0.3" />
            <circle cx="32" cy="48" r="6" fill="currentColor" opacity="0.5" />
            <path d="M32 38 C28 28, 22 14, 20 6" strokeLinecap="round" />
            <path d="M32 38 C30 28, 28 14, 28 4" strokeLinecap="round" />
            <path d="M32 38 C34 28, 36 14, 36 4" strokeLinecap="round" />
            <path d="M32 38 C36 28, 42 14, 44 6" strokeLinecap="round" />
          </svg>

          <svg className="absolute top-[18%] right-[12%] w-20 h-20 text-emerald-500/15 dark:text-emerald-400/10 animate-float-reverse [animation-delay:1s]" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
            <ellipse cx="32" cy="48" rx="10" ry="10" fill="currentColor" opacity="0.3" />
            <circle cx="32" cy="48" r="6" fill="currentColor" opacity="0.5" />
            <path d="M32 38 C28 28, 22 14, 20 6" strokeLinecap="round" />
            <path d="M32 38 C30 28, 28 14, 28 4" strokeLinecap="round" />
            <path d="M32 38 C34 28, 36 14, 36 4" strokeLinecap="round" />
            <path d="M32 38 C36 28, 42 14, 44 6" strokeLinecap="round" />
          </svg>

          <svg className="absolute bottom-[15%] left-[15%] w-12 h-12 text-green-600/15 dark:text-green-400/10 animate-float [animation-delay:2s]" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
            <ellipse cx="32" cy="48" rx="10" ry="10" fill="currentColor" opacity="0.3" />
            <circle cx="32" cy="48" r="6" fill="currentColor" opacity="0.5" />
            <path d="M32 38 C28 28, 22 14, 20 6" strokeLinecap="round" />
            <path d="M32 38 C30 28, 28 14, 28 4" strokeLinecap="round" />
            <path d="M32 38 C34 28, 36 14, 36 4" strokeLinecap="round" />
            <path d="M32 38 C36 28, 42 14, 44 6" strokeLinecap="round" />
          </svg>

          <svg className="absolute bottom-[25%] right-[8%] w-14 h-14 text-teal-500/20 dark:text-teal-400/15 animate-float-reverse [animation-delay:3s]" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
            <ellipse cx="32" cy="48" rx="10" ry="10" fill="currentColor" opacity="0.3" />
            <circle cx="32" cy="48" r="6" fill="currentColor" opacity="0.5" />
            <path d="M32 38 C28 28, 22 14, 20 6" strokeLinecap="round" />
            <path d="M32 38 C30 28, 28 14, 28 4" strokeLinecap="round" />
            <path d="M32 38 C34 28, 36 14, 36 4" strokeLinecap="round" />
            <path d="M32 38 C36 28, 42 14, 44 6" strokeLinecap="round" />
          </svg>

          <svg className="absolute top-[55%] left-[4%] w-10 h-10 text-emerald-500/15 dark:text-emerald-400/10 animate-float [animation-delay:4s]" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
            <ellipse cx="32" cy="48" rx="10" ry="10" fill="currentColor" opacity="0.3" />
            <circle cx="32" cy="48" r="6" fill="currentColor" opacity="0.5" />
            <path d="M32 38 C28 28, 22 14, 20 6" strokeLinecap="round" />
            <path d="M32 38 C30 28, 28 14, 28 4" strokeLinecap="round" />
            <path d="M32 38 C34 28, 36 14, 36 4" strokeLinecap="round" />
            <path d="M32 38 C36 28, 42 14, 44 6" strokeLinecap="round" />
          </svg>

          <svg className="absolute top-[8%] right-[35%] w-10 h-10 text-green-500/15 dark:text-green-400/10 animate-float-reverse [animation-delay:0.5s]" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
            <ellipse cx="32" cy="48" rx="10" ry="10" fill="currentColor" opacity="0.3" />
            <circle cx="32" cy="48" r="6" fill="currentColor" opacity="0.5" />
            <path d="M32 38 C28 28, 22 14, 20 6" strokeLinecap="round" />
            <path d="M32 38 C30 28, 28 14, 28 4" strokeLinecap="round" />
            <path d="M32 38 C34 28, 36 14, 36 4" strokeLinecap="round" />
            <path d="M32 38 C36 28, 42 14, 44 6" strokeLinecap="round" />
          </svg>

          {/* Decorative horizontal lines */}
          <div className="absolute top-[30%] left-0 w-full h-px bg-gradient-to-r from-transparent via-green-500/10 to-transparent" />
          <div className="absolute top-[70%] left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent" />
        </div>

        <div className="relative max-w-4xl text-center space-y-8">
          <Badge variant="secondary" className="text-sm px-4 py-1">
            Free to use — no credit card required
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
            Find your perfect
            <span className="bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
              {" "}badminton{" "}
            </span>
            match
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Connect with local players, organize sessions, and never miss a game
            again. Whether you&apos;re a beginner picking up a racket or a
            seasoned pro, your next game is just a click away.
          </p>
          <div className="flex gap-4 justify-center flex-col sm:flex-row">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto text-base px-8">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/sessions">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto text-base px-8"
              >
                Browse Sessions
              </Button>
            </Link>
          </div>

          {/* Real Stats */}
          <div className="flex items-center justify-center gap-8 sm:gap-16 pt-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl sm:text-3xl font-bold">
                  {stat.value > 0 ? `${stat.value}+` : "0"}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 sm:py-28 px-4 bg-muted/50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              Simple Process
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Up and running in minutes
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Three simple steps to go from solo player to having a full squad
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <Card
                key={step.num}
                className="relative overflow-hidden border-2 hover:border-primary/20 transition-colors"
              >
                <CardContent className="pt-8 pb-6 space-y-4">
                  <span className="text-5xl font-bold text-muted-foreground/20">
                    {step.num}
                  </span>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Badminton */}
      <section className="py-20 sm:py-28 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              Why Badminton?
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">
              More than just a sport
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Badminton is the world&apos;s fastest racket sport and one of the
              most played sports globally
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {benefits.map((b) => (
              <Card key={b.title} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6 flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <b.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{b.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {b.desc}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 sm:py-28 px-4 bg-muted/50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              Community Love
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">
              What players are saying
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Join a growing community of badminton enthusiasts who found their
              game on ShuttleMates
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <Card key={t.name} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              Built for Players
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Everything you need
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="flex gap-3 p-4 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <f.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Ready to find your next game?
          </h2>
          <p className="text-primary-foreground/80 max-w-xl mx-auto">
            Join badminton players who are already connecting, playing, and
            growing their network on ShuttleMates.
          </p>
          <div className="flex gap-4 justify-center flex-col sm:flex-row">
            <Link href="/signup">
              <Button
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto text-base px-8"
              >
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/sessions">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto text-base px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              >
                Browse Sessions
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <p className="font-bold text-lg mb-3">ShuttleMates</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Connecting badminton players across cities. Find your crew, book
                your court, play your game.
              </p>
            </div>
            <div>
              <p className="font-medium text-sm mb-3">Product</p>
              <div className="flex flex-col gap-2">
                <Link
                  href="/sessions"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Browse Sessions
                </Link>
                <Link
                  href="/signup"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Create Account
                </Link>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign In
                </Link>
              </div>
            </div>
            <div>
              <p className="font-medium text-sm mb-3">Community</p>
              <div className="flex flex-col gap-2">
                <Link
                  href="/sessions/new"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Host a Session
                </Link>
                <Link
                  href="/sessions"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Find Players
                </Link>
              </div>
            </div>
          </div>
          <Separator className="my-8" />
          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} ShuttleMates. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
