import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Key,
  Shield,
  Zap,
  Crown,
  CheckCircle2,
  Star,
  Sparkles,
  Gamepad2,
  Play,
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
import type { Showcase, Package } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { HeaderLogo } from "@/components/header-logo";
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
import {
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";

function formatIdr(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(String(value).replace(/,/g, "")) || 0 : Number(value);
  return new Intl.NumberFormat("id-ID").format(n);
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

export default function Landing() {
  const [filterType, setFilterType] = useState<"all" | "free" | "premium">("all");
  const [filterGame, setFilterGame] = useState<string>("all");
  const [videoModal, setVideoModal] = useState<{ id: number; vidId: string } | null>(null);

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
  const packageCards = useMemo(() => packageItems.slice(0, 3), [packageItems]);

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
            Roblox Script Key System
          </h1>
          <p className="mt-4 md:mt-6 text-base md:text-lg text-muted-foreground">
            Secure license keys with HWID binding. Generate, validate, and manage keys for your script—all in one place.
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

      {/* Pilih Paket */}
      {packageCards.length > 0 && (
        <section className="border-t bg-muted/30 py-12 md:py-16">
          <div className="container px-4">
            <h2 className="font-serif text-3xl font-bold tracking-wide text-center mb-2">Pilih Paket</h2>
            <p className="text-center text-muted-foreground mb-8 md:mb-10">Pilih durasi dan beli key via Discord.</p>
            {/* Mobile carousel */}
            <div className="sm:hidden">
              <Carousel className="relative">
                <CarouselContent>
                  {packageItems.map((pkg) => {
                    const features = [pkg.feature1, pkg.feature2, pkg.feature3, pkg.feature4].filter(Boolean);
                    return (
                      <CarouselItem key={pkg.id}>
                        <div
                          className={`relative flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden glass`}
                        >
                          {pkg.isPopular ? (
                            <div className="absolute left-0 right-0 top-0 bg-primary py-1.5 text-center text-xs font-semibold text-primary-foreground">
                              Most Popular
                            </div>
                          ) : null}
                          <div className={pkg.isPopular ? "pt-10" : ""}>
                            <div className="relative">
                              {pkg.imageUrl ? (
                                <div className="aspect-video w-full overflow-hidden bg-muted">
                                  <img src={pkg.imageUrl} alt="" className="h-full w-full object-cover" />
                                </div>
                              ) : (
                                <div className="aspect-video w-full bg-muted flex items-center justify-center">
                                  <span className="text-muted-foreground text-sm">No image</span>
                                </div>
                              )}
                            </div>
                            <div className="p-5 flex flex-1 flex-col">
                              <h3 className="font-semibold text-lg">{pkg.title}</h3>
                              <ul className="mt-3 space-y-1.5 text-sm">
                                {features.map((f, i) => (
                                  <li key={i} className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                    {f}
                                  </li>
                                ))}
                              </ul>
                              <p className="mt-4 text-xl font-bold">IDR {formatIdr(pkg.price ?? 0)}</p>
                              <Button className="mt-4 w-full" asChild>
                                <a href={pkg.buyLink} target="_blank" rel="noopener noreferrer">
                                  Beli Sekarang
                                </a>
                              </Button>
                            </div>
                            <CarouselPrevious
                              className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-primary/40 bg-background/60 backdrop-blur shadow-[0_0_10px_hsl(var(--primary)/0.6)] hover:shadow-[0_0_18px_hsl(var(--primary)/0.9)]"
                            />
                            <CarouselNext
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-primary/40 bg-background/60 backdrop-blur shadow-[0_0_10px_hsl(var(--primary)/0.6)] hover:shadow-[0_0_18px_hsl(var(--primary)/0.9)]"
                            />
                          </div>
                        </div>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
              </Carousel>
            </div>
            {/* Desktop grid */}
            <div className="hidden sm:grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
              {packageCards.map((pkg) => {
                const features = [pkg.feature1, pkg.feature2, pkg.feature3, pkg.feature4].filter(Boolean);
                return (
                  <div
                    key={pkg.id}
                    className={`relative flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden glass ${
                      pkg.isPopular ? "ring-2 ring-primary shadow-lg" : ""
                    }`}
                  >
                    {pkg.isPopular ? (
                      <div className="absolute left-0 right-0 top-0 bg-primary py-1.5 text-center text-xs font-semibold text-primary-foreground">
                        Most Popular
                      </div>
                    ) : null}
                    <div className={pkg.isPopular ? "pt-10" : ""}>
                      {pkg.imageUrl ? (
                        <div className="aspect-video w-full overflow-hidden bg-muted">
                          <img src={pkg.imageUrl} alt="" className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="aspect-video w-full bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground text-sm">No image</span>
                        </div>
                      )}
                      <div className="p-5 flex flex-1 flex-col">
                        <h3 className="font-semibold text-lg">{pkg.title}</h3>
                        <ul className="mt-3 space-y-1.5 text-sm">
                          {features.map((f, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-4 text-xl font-bold">IDR {formatIdr(pkg.price ?? 0)}</p>
                        <Button className="mt-4 w-full" asChild>
                          <a href={pkg.buyLink} target="_blank" rel="noopener noreferrer">
                            Beli Sekarang
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {packageItems.length > 3 && (
              <div className="mt-8 text-center">
                <Link href="/beli">
                  <Button variant="outline">Lihat semua paket</Button>
                </Link>
              </div>
            )}
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
            {/* Mobile carousel */}
            <div className="sm:hidden">
              <Carousel>
                <CarouselContent>
                  {filtered.map((item) => {
                    const vidId = getYoutubeId(item.youtubeUrl);
                    const Icon1 = ICON_MAP[item.feature1Icon ?? "Zap"] ?? Zap;
                    const Icon2 = ICON_MAP[item.feature2Icon ?? "Shield"] ?? Shield;
                    const Icon3 = ICON_MAP[item.feature3Icon ?? "Star"] ?? Star;
                    return (
                      <CarouselItem key={item.id}>
                        <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm glass">
                          <div className="absolute right-2 top-2 z-10">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                item.type === "free"
                                  ? "bg-chart-2 text-white"
                                  : "bg-amber-500 text-black"
                              }`}
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
                                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90">
                                    <Play className="h-7 w-7 text-primary ml-1" />
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
                            <h3 className="font-semibold text-lg">{item.scriptName}</h3>
                            <p className="text-sm text-muted-foreground">{item.gameName}</p>
                            <ul className="mt-3 space-y-1.5 text-sm">
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
                          </div>
                          <CarouselPrevious
                            className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-primary/40 bg-background/60 backdrop-blur shadow-[0_0_10px_hsl(var(--primary)/0.6)] hover:shadow-[0_0_18px_hsl(var(--primary)/0.9)]"
                          />
                          <CarouselNext
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-primary/40 bg-background/60 backdrop-blur shadow-[0_0_10px_hsl(var(--primary)/0.6)] hover:shadow-[0_0_18px_hsl(var(--primary)/0.9)]"
                          />
                        </div>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
              </Carousel>
            </div>
            {/* Desktop grid */}
            <div className="hidden sm:grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => {
                const vidId = getYoutubeId(item.youtubeUrl);
                const Icon1 = ICON_MAP[item.feature1Icon ?? "Zap"] ?? Zap;
                const Icon2 = ICON_MAP[item.feature2Icon ?? "Shield"] ?? Shield;
                const Icon3 = ICON_MAP[item.feature3Icon ?? "Star"] ?? Star;
                return (
                  <div
                    key={item.id}
                    className="group relative flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm glass"
                  >
                    <div className="absolute right-2 top-2 z-10">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          item.type === "free"
                            ? "bg-chart-2 text-white"
                            : "bg-amber-500 text-black"
                        }`}
                      >
                        {item.type === "free" ? "FREE" : "PREMIUM"}
                      </span>
                    </div>
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
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90">
                            <Play className="h-7 w-7 text-primary ml-1" />
                          </div>
                        </div>
                      </button>
                    ) : (
                      <div className="aspect-video w-full bg-muted flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">No video</span>
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-semibold text-lg">{item.scriptName}</h3>
                      <p className="text-sm text-muted-foreground">{item.gameName}</p>
                      <ul className="mt-3 space-y-1.5 text-sm">
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
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
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
                );
              })}
            </div>
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
              <h3 className="mt-4 font-semibold text-lg">HWID Binding</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                One key, one device. Keys bind to hardware ID so they can&apos;t be shared or leaked.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-2/10">
                <Zap className="h-6 w-6 text-chart-2" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">Instant Validation</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Simple API for your Roblox executor. Validate keys in real time with clear success or error messages.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-3/10">
                <Key className="h-6 w-6 text-chart-3" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">Dashboard</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Generate keys, track revenue, blacklist abuse, and reset HWID—all from one dashboard.
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
            { step: 1, title: "Get a key", desc: "Purchase a license key from the script seller (Discord, etc.)." },
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
            © KingVypers · Key Management System
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
