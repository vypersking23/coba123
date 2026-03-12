import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Key,
  Shield,
  Zap,
  Crown,
  LogIn,
  CheckCircle2,
  Star,
  Sparkles,
  Gamepad2,
  Play,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Linkedin,
  Github,
  Twitter,
  Heart,
  Eye,
  Gift,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Showcase, Package, Team, Testimonial, GameSupport } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { HeaderLogo } from "@/components/header-logo";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

function formatIdr(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(String(value).replace(/,/g, "")) || 0 : Number(value);
  return new Intl.NumberFormat("id-ID").format(n);
}

function getInitials(value: string) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  const initials = parts.map((p) => p[0]?.toUpperCase()).join("");
  return initials || "KV";
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  Shield,
  Star,
  Sparkles,
  Key,
  Crown,
  Gamepad2,
  CheckCircle2,
};

function getYoutubeId(url: string | null): string {
  if (!url) return "";
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : "";
}

const DISCORD_INVITE = "https://discord.gg/vGT2km9gh";

const TEAM_ACCENT_STYLES: Record<
  string,
  {
    topBar: string;
    rolePill: string;
    avatarRing: string;
    iconButton: string;
    glow: string;
  }
> = {
  primary: {
    topBar: "from-primary to-secondary",
    rolePill: "bg-primary/15 text-primary border-primary/25",
    avatarRing: "ring-primary/30",
    iconButton: "hover:bg-primary/10 hover:text-primary",
    glow: "from-primary/25 to-secondary/10",
  },
  gold: {
    topBar: "from-amber-400 to-orange-600",
    rolePill: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    avatarRing: "ring-amber-500/25",
    iconButton: "hover:bg-amber-500/10 hover:text-amber-400",
    glow: "from-amber-500/25 to-orange-500/10",
  },
  emerald: {
    topBar: "from-emerald-400 to-teal-500",
    rolePill: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    avatarRing: "ring-emerald-500/25",
    iconButton: "hover:bg-emerald-500/10 hover:text-emerald-400",
    glow: "from-emerald-500/25 to-teal-500/10",
  },
  sky: {
    topBar: "from-sky-400 to-indigo-500",
    rolePill: "bg-sky-500/15 text-sky-400 border-sky-500/25",
    avatarRing: "ring-sky-500/25",
    iconButton: "hover:bg-sky-500/10 hover:text-sky-400",
    glow: "from-sky-500/25 to-indigo-500/10",
  },
  violet: {
    topBar: "from-violet-500 to-fuchsia-500",
    rolePill: "bg-violet-500/15 text-violet-400 border-violet-500/25",
    avatarRing: "ring-violet-500/25",
    iconButton: "hover:bg-violet-500/10 hover:text-violet-400",
    glow: "from-violet-500/25 to-fuchsia-500/10",
  },
  rose: {
    topBar: "from-rose-500 to-pink-500",
    rolePill: "bg-rose-500/15 text-rose-400 border-rose-500/25",
    avatarRing: "ring-rose-500/25",
    iconButton: "hover:bg-rose-500/10 hover:text-rose-400",
    glow: "from-rose-500/25 to-pink-500/10",
  },
};

function MobileCarouselControls({ api }: { api: any }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  useEffect(() => {
    if (!api) return;

    const sync = () => {
      setSnapCount(api.scrollSnapList().length);
      setSelectedIndex(api.selectedScrollSnap());
    };

    sync();
    api.on("reInit", sync);
    api.on("select", sync);
    return () => {
      api.off("reInit", sync);
      api.off("select", sync);
    };
  }, [api]);

  if (!api || snapCount <= 1) return null;

  const canPrev = api.canScrollPrev();
  const canNext = api.canScrollNext();

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-full bg-background/70 backdrop-blur"
        onClick={() => api.scrollPrev()}
        disabled={!canPrev}
        aria-label="Sebelumnya"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1.5">
        {Array.from({ length: snapCount }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => api.scrollTo(i)}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-all",
              i === selectedIndex ? "w-5 bg-primary" : "bg-muted-foreground/35",
            )}
            aria-label={`Slide ${i + 1}`}
            aria-current={i === selectedIndex}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-full bg-background/70 backdrop-blur"
        onClick={() => api.scrollNext()}
        disabled={!canNext}
        aria-label="Berikutnya"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function Landing() {
  const [filterType, setFilterType] = useState<"all" | "free" | "premium">("all");
  const [filterGame, setFilterGame] = useState<string>("all");
  const [videoModal, setVideoModal] = useState<{ id: number; vidId: string } | null>(null);
  const [packagesApi, setPackagesApi] = useState<any>(null);
  const [showcaseApi, setShowcaseApi] = useState<any>(null);
  const [gameSupportApi, setGameSupportApi] = useState<any>(null);
  const [gameSupportDir, setGameSupportDir] = useState<1 | -1>(1);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const { data: showcaseItems = [] } = useQuery<Showcase[]>({
    queryKey: ["/api/showcase"],
    queryFn: async () => {
      const res = await fetch("/api/showcase");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const viewMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/showcase/${id}/view`, { method: "POST" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed")))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/showcase"] }),
  });

  const likeMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/showcase/${id}/like`, { method: "POST" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed")))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/showcase"] }),
  });

  const tipMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/showcase/${id}/tip`, { method: "POST" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed")))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/showcase"] }),
  });

  const openVideo = (item: Showcase) => {
    const vidId = getYoutubeId(item.youtubeUrl);
    if (vidId) {
      setVideoModal({ id: item.id, vidId });
      viewMutation.mutate(item.id);
    }
  };

  const games = useMemo(() => {
    const set = new Set(showcaseItems.map((s) => s.gameName).filter(Boolean));
    return Array.from(set).sort();
  }, [showcaseItems]);

  const filtered = useMemo(() => {
    return showcaseItems.filter((item) => {
      if (filterType !== "all" && item.type !== filterType) return false;
      if (filterGame !== "all" && item.gameName !== filterGame) return false;
      return true;
    });
  }, [showcaseItems, filterType, filterGame]);

  const { data: packageItems = [] } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
    queryFn: async () => {
      const res = await fetch("/api/packages");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: stockData } = useQuery<{
    items: Array<{ id: number; totalAvailable: number; exactAvailable: number; genericAvailable: number }>;
  }>({
    queryKey: ["/api/stocks/packages"],
    queryFn: async () => {
      const res = await fetch("/api/stocks/packages");
      if (!res.ok) return { items: [] };
      return res.json();
    },
  });

  const stockById = useMemo(() => {
    return new Map<number, { totalAvailable: number; exactAvailable: number; genericAvailable: number }>(
      (stockData?.items || []).map((s) => [
        s.id,
        {
          totalAvailable: s.totalAvailable,
          exactAvailable: s.exactAvailable,
          genericAvailable: s.genericAvailable,
        },
      ]),
    );
  }, [stockData?.items]);

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const res = await fetch("/api/teams");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: testimonials = [] } = useQuery<Testimonial[]>({
    queryKey: ["/api/testimonials"],
    queryFn: async () => {
      const res = await fetch("/api/testimonials");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: gameSupport = [] } = useQuery<GameSupport[]>({
    queryKey: ["/api/game-support"],
    queryFn: async () => {
      const res = await fetch("/api/game-support");
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (!gameSupportApi) return;
    const id = setInterval(() => {
      if (gameSupportDir === 1) gameSupportApi.scrollNext?.();
      else gameSupportApi.scrollPrev?.();
    }, 2600);
    return () => clearInterval(id);
  }, [gameSupportApi, gameSupportDir]);

  return (
    <div className="min-h-screen bg-background circuit-overlay">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b glass">
        <div className="container flex h-16 items-center justify-between gap-2 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-serif text-xl font-bold tracking-wide">
            <HeaderLogo size="md" />
            KingVypers
          </Link>
          <nav className="hidden sm:flex items-center gap-3 flex-shrink-0">
            <Button variant="outline" size="sm" asChild>
              <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                <MessageCircle className="h-4 w-4" />
                Join Discord
              </a>
            </Button>
            <Link href="/login">
              <Button variant="outline" size="sm" className="gap-1.5">
                <LogIn className="h-4 w-4" />
                Login
              </Button>
            </Link>
            <Link href="/beli">
              <Button variant="default" size="sm">Beli Sekarang</Button>
            </Link>
            <Link href="/validate">
              <Button variant="ghost" size="sm">
                Validate Key
              </Button>
            </Link>
          </nav>
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Menu
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem>
                  <a href="/login" className="w-full">
                    Login
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="w-full">
                    Join Discord
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <a href="/beli" className="w-full">
                    Beli Sekarang
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <a href="/validate" className="w-full">
                    Validate Key
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container px-4 py-16 md:py-24 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            King Vypers
          </h1>
          <p className="mt-2 text-sm font-medium tracking-widest uppercase text-muted-foreground/60">
            Premium Roblox Scripts
          </p>
          <p className="mt-4 md:mt-6 text-base md:text-lg text-muted-foreground">
            Not everyone gets access. You do.
          </p>
          <div className="mt-8 md:mt-10 flex flex-wrap items-center justify-center gap-3 md:gap-4">
            <Button size="lg" variant="outline" className="gap-2 text-base" asChild>
              <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5" />
                Join Discord
              </a>
            </Button>
            <Link href="/beli">
              <Button size="lg" className="gap-2 text-base">
                Beli Sekarang
              </Button>
            </Link>
            <Link href="/validate">
              <Button size="lg" variant="outline" className="gap-2 text-base">
                <Key className="h-5 w-5" />
                Validate My Key
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {gameSupport.length > 0 && (
        <section className="border-t bg-muted/20 py-8">
          <div className="container px-4">
            <div className="mx-auto max-w-5xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Game Support</div>
                  <div className="text-xs text-muted-foreground">.</div>
                </div>
              </div>

              <div
                onWheel={(e) => {
                  if (Math.abs(e.deltaX) < 4) return;
                  setGameSupportDir(e.deltaX > 0 ? 1 : -1);
                }}
                onTouchStart={(e) => setTouchStartX(e.touches[0]?.clientX ?? null)}
                onTouchMove={(e) => {
                  const x = e.touches[0]?.clientX ?? null;
                  if (x === null || touchStartX === null) return;
                  const diff = touchStartX - x;
                  if (diff > 16) setGameSupportDir(1);
                  if (diff < -16) setGameSupportDir(-1);
                }}
                onTouchEnd={() => setTouchStartX(null)}
                className="rounded-2xl border bg-background/50 p-4 backdrop-blur"
              >
                <Carousel setApi={setGameSupportApi} opts={{ align: "start", loop: true, dragFree: true }}>
                  <CarouselContent>
                    {gameSupport.map((g) => (
                      <CarouselItem key={g.id} className="basis-[46%] sm:basis-1/4 md:basis-1/6 lg:basis-1/8">
                        {(() => {
                          const status = (g as any).status || "ready";
                          const dot =
                            status === "maintenance"
                              ? "bg-amber-500"
                              : status === "comingsoon"
                                ? "bg-muted-foreground/40"
                                : "bg-emerald-500";
                          const label = status === "maintenance" ? "Maint" : status === "comingsoon" ? "Soon" : "";
                          const opacity = status === "comingsoon" ? "opacity-60" : status === "maintenance" ? "opacity-90" : "";
                          return (
                            <div className={`flex items-center gap-2 rounded-xl border bg-card/70 px-3 py-2 shadow-sm ${opacity}`}>
                              <div className="h-7 w-7 overflow-hidden rounded-lg border bg-muted">
                                {g.logoUrl ? <img src={g.logoUrl} alt="" className="h-full w-full object-cover" /> : null}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                                  <span className="min-w-0 truncate text-xs font-medium">{g.gameName}</span>
                                </div>
                                {label ? <div className="mt-0.5 text-[10px] text-muted-foreground">{label}</div> : null}
                              </div>
                            </div>
                          );
                        })()}
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Pilih Paket */}
      {packageItems.length > 0 && (
        <section className="border-t bg-muted/30 py-12 md:py-16">
          <div className="container px-4">
            <h2 className="font-serif text-3xl font-bold tracking-wide text-center mb-2">Choose Your Plan</h2>
            <p className="text-center text-muted-foreground mb-8 md:mb-10">Select a duration, complete payment, and receive your key instantly.</p>
            <div className="mx-auto max-w-5xl">
              <Carousel className="relative" setApi={setPackagesApi} opts={{ align: "start" }}>
                <CarouselContent>
                  {packageItems.map((pkg) => {
                    const features = [pkg.feature1, pkg.feature2, pkg.feature3, pkg.feature4].filter(Boolean);
                    const price = Number(pkg.price ?? 0) || 0;
                    const original = Number(pkg.originalPrice ?? 0) || 0;
                    const hasDiscount = original > 0 && original > price;
                    return (
                      <CarouselItem key={pkg.id} className="basis-[78%] sm:basis-1/2 lg:basis-1/3">
                        <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card/70 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-lg glass">
                          <div className={cn("h-1.5 w-full bg-gradient-to-r", pkg.isPopular ? "from-primary to-secondary" : "from-muted to-muted")} />
                          <div className="relative p-4">
                            <div className={cn("pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-gradient-to-br blur-3xl", pkg.isPopular ? "from-primary/30 to-secondary/10" : "from-muted/30 to-muted/10")} />
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="text-base font-semibold">{pkg.title}</h3>
                                <div className="mt-1 text-xs text-muted-foreground">{pkg.durationDays} hari akses</div>
                              </div>
                              {pkg.isPopular ? (
                                <span className="rounded-full border border-primary/25 bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                                  Popular
                                </span>
                              ) : null}
                            </div>

                            {pkg.imageUrl ? (
                              <div className="mt-4 overflow-hidden rounded-xl border bg-muted/20">
                                <img src={pkg.imageUrl} alt="" className="h-24 w-full object-cover transition group-hover:opacity-95" />
                              </div>
                            ) : (
                              <div className="mt-4 h-24 overflow-hidden rounded-xl border bg-gradient-to-r from-primary/10 via-background to-secondary/10" />
                            )}

                            {features.length > 0 ? (
                              <ul className="mt-4 space-y-2 text-xs">
                                {features.slice(0, 3).map((f, i) => (
                                  <li key={i} className="flex items-center gap-2 text-muted-foreground">
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                    <span className="text-foreground/90">{f}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}

                            <div className="mt-5 flex items-end justify-between gap-3">
                              <div>
                                {hasDiscount ? (
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-sm text-muted-foreground line-through">IDR {formatIdr(original)}</span>
                                    <span className="text-xl font-bold">IDR {formatIdr(price)}</span>
                                  </div>
                                ) : (
                                  <div className="text-xl font-bold">IDR {formatIdr(price)}</div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">QRIS</div>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">Sisa key: {stockById.get(pkg.id)?.totalAvailable ?? 0}</div>

                            <Link href="/login">
                              <Button className="mt-4 w-full">Beli Sekarang</Button>
                            </Link>
                          </div>
                        </div>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
              </Carousel>
              <MobileCarouselControls api={packagesApi} />
            </div>
          </div>
        </section>
      )}

      {/* Showcase */}
      {showcaseItems.length > 0 && (
        <section className="border-t bg-muted/30 py-12 md:py-16">
          <div className="container px-4">
            <h2 className="font-serif text-3xl font-bold tracking-wide text-center mb-8">
              Scripts
            </h2>
            <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Type:</span>
              <div className="flex rounded-lg border bg-background p-1">
                {(["all", "free", "premium"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterType(t)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                      filterType === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {games.length > 0 && (
                <>
                  <span className="ml-4 text-sm font-medium text-muted-foreground">Game:</span>
                  <div className="flex flex-wrap gap-1 rounded-lg border bg-background p-1">
                    <button
                      type="button"
                      onClick={() => setFilterGame("all")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                        filterGame === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                    >
                      All Games
                    </button>
                    {games.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setFilterGame(g)}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                          filterGame === g ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <Carousel setApi={setShowcaseApi} opts={{ align: "start" }}>
              <CarouselContent>
                {filtered.map((item) => {
                  const vidId = getYoutubeId(item.youtubeUrl);
                  const Icon1 = ICON_MAP[item.feature1Icon ?? "Zap"] ?? Zap;
                  const Icon2 = ICON_MAP[item.feature2Icon ?? "Shield"] ?? Shield;
                  const Icon3 = ICON_MAP[item.feature3Icon ?? "Star"] ?? Star;
                  return (
                    <CarouselItem key={item.id} className="basis-[86%] sm:basis-1/2 lg:basis-1/3">
                      <div className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card/70 text-card-foreground shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-lg glass">
                        <div className={cn("h-1.5 w-full bg-gradient-to-r", item.type === "free" ? "from-emerald-400 to-teal-500" : "from-amber-400 to-orange-600")} />
                        <div className="absolute right-3 top-3 z-10">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              item.type === "free" ? "bg-chart-2 text-white" : "bg-amber-500 text-black",
                            )}
                          >
                            {item.type === "free" ? "FREE" : "PREMIUM"}
                          </span>
                        </div>
                        <div className="relative">
                          {vidId ? (
                            <button
                              type="button"
                              className="relative aspect-video w-full overflow-hidden bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                              onClick={() => openVideo(item)}
                            >
                              <img
                                src={`https://img.youtube.com/vi/${vidId}/mqdefault.jpg`}
                                alt=""
                                className="h-full w-full object-cover transition group-hover:opacity-90"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/40">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
                                  <Play className="h-6 w-6 text-primary ml-0.5" />
                                </div>
                              </div>
                            </button>
                          ) : (
                            <div className="aspect-video w-full bg-muted flex items-center justify-center">
                              <span className="text-muted-foreground text-sm">No video</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-4">
                          <h3 className="font-semibold text-base">{item.scriptName}</h3>
                          <p className="text-xs text-muted-foreground">{item.gameName}</p>
                          <ul className="mt-3 space-y-2 text-xs">
                            <li className="flex items-center gap-2">
                              <Icon1 className="h-4 w-4 shrink-0 text-primary" />
                              {item.feature1Text}
                            </li>
                            <li className="flex items-center gap-2">
                              <Icon2 className="h-4 w-4 shrink-0 text-primary" />
                              {item.feature2Text}
                            </li>
                            <li className="flex items-center gap-2">
                              <Icon3 className="h-4 w-4 shrink-0 text-primary" />
                              {item.feature3Text}
                            </li>
                          </ul>
                          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <button
                              type="button"
                              onClick={() => likeMutation.mutate(item.id)}
                              className="inline-flex items-center gap-1 rounded-md p-1.5 hover:bg-muted hover:text-foreground"
                              title="Suka"
                            >
                              <Heart className="h-4 w-4" />
                              <span>{item.likeCount ?? 0}</span>
                            </button>
                            <span className="inline-flex items-center gap-1" title="Dilihat">
                              <Eye className="h-4 w-4" />
                              <span>{item.viewCount ?? 0}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => tipMutation.mutate(item.id)}
                              className="inline-flex items-center gap-1 rounded-md p-1.5 hover:bg-muted hover:text-foreground"
                              title="Tanda mata"
                            >
                              <Gift className="h-4 w-4" />
                              <span>{item.tipCount ?? 0}</span>
                            </button>
                          </div>
                          {item.buttonLabel && item.buttonUrl ? (
                            <div className="mt-4">
                              <Button className="w-full" asChild>
                                <a href={item.buttonUrl} target="_blank" rel="noopener noreferrer">
                                  {item.buttonLabel}
                                </a>
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
            </Carousel>
            <MobileCarouselControls api={showcaseApi} />
            {filtered.length === 0 && (
              <p className="py-12 text-center text-muted-foreground">No scripts match the selected filters.</p>
            )}
          </div>
        </section>
      )}

      {/* Video modal */}
      <Dialog open={!!videoModal} onOpenChange={() => setVideoModal(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Video</DialogTitle>
          </DialogHeader>
          {videoModal && (
            <div>
              <div className="aspect-video w-full bg-black">
                <iframe
                  title="YouTube"
                  src={`https://www.youtube-nocookie.com/embed/${videoModal.vidId}`}
                  className="h-full w-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
              <div className="flex justify-center border-t bg-muted/50 p-3">
                <a
                  href={`https://www.youtube.com/watch?v=${videoModal.vidId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  <Play className="h-4 w-4" />
                  Tonton di YouTube
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Our Team */}
      {teams.length > 0 && (
        <section className="relative overflow-hidden border-t bg-muted/30 py-10 md:py-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-primary/10 to-secondary/5 blur-3xl" />
            <div className="absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-secondary/10 to-primary/5 blur-3xl" />
          </div>
          <div className="container relative px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-serif text-3xl font-bold tracking-wide">Meet the Team</h2>
              <p className="mt-2 text-muted-foreground">The minds behind every update, every feature, every drop.</p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((m) => (
                <div
                  key={m.id}
                  className="group relative overflow-hidden rounded-2xl border bg-card/70 shadow-sm backdrop-blur transition hover:shadow-lg glass"
                >
                  {(() => {
                    const style = TEAM_ACCENT_STYLES[m.accent ?? ""] ?? TEAM_ACCENT_STYLES.primary;
                    return (
                      <>
                        <div className={cn("h-1.5 w-full bg-gradient-to-r", style.topBar)} />
                        <div className={cn("pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br blur-3xl opacity-60", style.glow)} />

                        <div className="relative p-4">
                          <div className="flex items-start gap-3">
                            <div className={cn("h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-background/70", style.avatarRing)}>
                              {m.photoUrl ? (
                                <img src={m.photoUrl} alt={m.fullName} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-foreground/90">
                                  {getInitials(m.fullName)}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold">{m.fullName}</p>
                                  <span className={cn("mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", style.rolePill)}>
                                    {m.role}
                                  </span>
                                </div>
                                {(m.instagram || m.linkedin || m.github || m.twitter) ? (
                                  <div className="flex shrink-0 items-center gap-1">
                                    {m.instagram && (
                                      <a
                                        href={m.instagram}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="Instagram"
                                        className={cn(
                                          "inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background/50 text-muted-foreground transition",
                                          style.iconButton,
                                        )}
                                      >
                                        <Instagram className="h-4 w-4" />
                                      </a>
                                    )}
                                    {m.linkedin && (
                                      <a
                                        href={m.linkedin}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="LinkedIn"
                                        className={cn(
                                          "inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background/50 text-muted-foreground transition",
                                          style.iconButton,
                                        )}
                                      >
                                        <Linkedin className="h-4 w-4" />
                                      </a>
                                    )}
                                    {m.github && (
                                      <a
                                        href={m.github}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="GitHub"
                                        className={cn(
                                          "inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background/50 text-muted-foreground transition",
                                          style.iconButton,
                                        )}
                                      >
                                        <Github className="h-4 w-4" />
                                      </a>
                                    )}
                                    {m.twitter && (
                                      <a
                                        href={m.twitter}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="Twitter"
                                        className={cn(
                                          "inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background/50 text-muted-foreground transition",
                                          style.iconButton,
                                        )}
                                      >
                                        <Twitter className="h-4 w-4" />
                                      </a>
                                    )}
                                  </div>
                                ) : null}
                              </div>

                              {m.description ? (
                                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>
                              ) : null}

                              {[m.skill1, m.skill2, m.skill3, m.skill4].filter(Boolean).length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {[m.skill1, m.skill2, m.skill3, m.skill4].filter(Boolean).map((s, i) => (
                                    <span key={i} className="rounded-full border bg-background/50 px-2 py-0.5 text-[11px] text-foreground/90">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {Array.isArray(testimonials) && testimonials.length > 0 && (
        <section className="border-t bg-muted/30 py-12 md:py-16">
          <div className="container px-4">
            <h2 className="font-serif text-3xl font-bold tracking-wide text-center mb-2">Testimonials</h2>
            <p className="text-center text-muted-foreground mb-8 md:mb-10">Real feedback from users.</p>
            <div className="mx-auto max-w-5xl">
              <Carousel opts={{ align: "start" }}>
                <CarouselContent>
                  {testimonials.map((t) => {
                    const rating = Math.max(1, Math.min(5, Number(t.rating || 5)));
                    const name = String(t.fullName || "User");
                    const profileUrl = String(t.profileUrl || "");
                    const message = String(t.message || "");
                    return (
                      <CarouselItem key={t.id || `${name}-${message}`} className="basis-[78%] sm:basis-1/2 lg:basis-1/3">
                        <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card/70 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-lg glass">
                          <div className="h-1.5 w-full bg-gradient-to-r from-primary to-secondary" />
                          <div className="relative p-4">
                            <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-gradient-to-br from-primary/25 to-secondary/10 blur-3xl" />
                            <div className="flex items-start gap-3">
                              <div className="h-11 w-11 overflow-hidden rounded-2xl border bg-muted">
                                {profileUrl ? <img src={profileUrl} alt="" className="h-full w-full object-cover" /> : null}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="truncate font-semibold">{name}</div>
                                  {profileUrl ? (
                                    <a
                                      href={profileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-muted-foreground hover:text-foreground"
                                    >
                                      Profile
                                    </a>
                                  ) : null}
                                </div>
                                <div className="mt-1 flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={cn(i < rating ? "h-4 w-4 text-amber-400" : "h-4 w-4 text-muted-foreground/25")}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{message}</p>
                          </div>
                        </div>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
              </Carousel>
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container px-4">
          <h2 className="font-serif text-3xl font-bold tracking-wide text-center mb-12">
            Why KingVypers?
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">Always Undetected</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Updated constantly to stay ahead. Your account stays safe, every session.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-2/10">
                <Zap className="h-6 w-6 text-chart-2" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">Loaded with Features</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Aimbot, Blatant, ESP, auto-farm — everything you need to dominate, packed in one script.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-3/10">
                <Key className="h-6 w-6 text-chart-3" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">Instant & Easy</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Buy a key, paste the script, execute. No setup, no hassle — just results.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container px-4 py-20">
        <h2 className="font-serif text-3xl font-bold tracking-wide text-center mb-12">
          How It Works
        </h2>
        <div className="mx-auto max-w-2xl space-y-6">
          {[
            { step: 1, title: "Get a key", desc: "Purchase a key via our Discord or website. Takes less than a minute." },
            { step: 2, title: "Validate once", desc: "Enter your key in the executor or on this site. It binds to your device (HWID)." },
            { step: 3, title: "Use the script", desc: "As long as the key is active and not expired, you're good to go." },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-4 rounded-lg border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {step}
              </div>
              <div>
                <h3 className="font-medium">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-chart-2" />
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-primary/5 py-12 md:py-16">
        <div className="container px-4 text-center">
          <h2 className="font-serif text-2xl font-bold tracking-wide">
            Already have a key?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Validate it here or check your key status.
          </p>
          <Link href="/validate">
            <Button size="lg" className="mt-5 md:mt-6">
              Validate Key
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
          <span className="text-sm text-muted-foreground">
            © KingVypers · 2026
          </span>
          <div className="flex gap-6">
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              Join Discord
            </a>
            <Link href="/validate" className="text-sm text-muted-foreground hover:text-foreground">
              Validate Key
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
