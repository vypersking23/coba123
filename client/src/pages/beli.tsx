import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { HeaderLogo } from "@/components/header-logo";
import type { Package } from "@shared/schema";

function formatIdr(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(String(value).replace(/,/g, "")) || 0 : Number(value);
  return new Intl.NumberFormat("id-ID").format(n);
}

export default function BeliSekarang() {
  const { data: packages = [], isLoading } = useQuery<Package[]>({
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

  const stockById = new Map<number, { totalAvailable: number; exactAvailable: number; genericAvailable: number }>(
    (stockData?.items || []).map((s) => [s.id, { totalAvailable: s.totalAvailable, exactAvailable: s.exactAvailable, genericAvailable: s.genericAvailable }]),
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-serif text-xl font-bold tracking-wide">
            <HeaderLogo size="md" />
            KingVypers
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/beli">
              <Button variant="default" size="sm">Beli Sekarang</Button>
            </Link>
            <Link href="/validate">
              <Button variant="ghost" size="sm">Validate Key</Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="container px-4 py-12 md:py-16">
        <h1 className="font-serif text-3xl font-bold tracking-wide text-center mb-2">Beli Key</h1>
        <p className="text-center text-muted-foreground mb-10">Pilih paket, lalu bayar via QRIS.</p>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : packages.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">Belum ada paket. Cek lagi nanti.</p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {packages.map((pkg) => {
              const features = [pkg.feature1, pkg.feature2, pkg.feature3, pkg.feature4].filter(Boolean);
              const price = Number(pkg.price ?? 0) || 0;
              const original = Number(pkg.originalPrice ?? 0) || 0;
              const hasDiscount = original > 0 && original > price;
              return (
                <div
                  key={pkg.id}
                  className="relative flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden"
                >
                  {pkg.isPopular ? (
                    <div className="absolute left-0 right-0 top-0 bg-primary py-1 text-center text-xs font-semibold text-primary-foreground">
                      Most Popular
                    </div>
                  ) : null}
                  <div className={pkg.isPopular ? "pt-8" : ""}>
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
                      <h2 className="font-semibold text-lg">{pkg.title}</h2>
                      <p className="text-sm text-muted-foreground mt-1">{pkg.durationDays} hari</p>
                      <ul className="mt-3 space-y-1.5 text-sm">
                        {features.map((f, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4">
                        {hasDiscount ? (
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-muted-foreground line-through">IDR {formatIdr(original)}</span>
                            <span className="text-xl font-bold">IDR {formatIdr(price)}</span>
                          </div>
                        ) : (
                          <p className="text-xl font-bold">IDR {formatIdr(price)}</p>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">Sisa key: {stockById.get(pkg.id)?.totalAvailable ?? 0}</p>
                      <Link href="/login">
                        <Button className="mt-4 w-full">
                          Beli Sekarang
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 text-center">
          <Link href="/">
            <Button variant="outline">Kembali ke Beranda</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
