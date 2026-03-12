interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  badge?: string;
}

export function PageHeader({ title, subtitle, action, badge }: PageHeaderProps) {
  return (
    <div className="relative overflow-hidden border-b">
      {/* Background gradient — visible emerald tint */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-background to-background dark:from-emerald-950/50 dark:via-zinc-950 dark:to-background" />

      {/* Dot grid */}
      <div
        className="hero-grid absolute inset-0 text-foreground/[0.04] dark:text-white/[0.03] pointer-events-none"
      />

      {/* Glowing orbs */}
      <div className="absolute -top-12 right-0 w-96 h-48 bg-emerald-400/10 dark:bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -left-8 w-64 h-32 bg-emerald-500/8 blur-2xl pointer-events-none" />

      <div className="relative container mx-auto px-4 py-8 md:py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            {badge && (
              <span className="inline-flex items-center gap-1.5 mb-3 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3 py-1 text-xs font-semibold border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {badge}
              </span>
            )}
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-2 max-w-md">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0 pb-1">{action}</div>}
        </div>
      </div>
    </div>
  );
}
