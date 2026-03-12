import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function getQueryParam(search: string, key: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get(key);
}

export default function Thanks() {
  const [location] = useLocation();
  const [, search] = location.split("?");
  const orderId = search ? getQueryParam(search, "order_id") : null;
  const amount = search ? getQueryParam(search, "amount") : null;
  const status = search ? getQueryParam(search, "status") : null;

  return (
    <div className="min-h-screen bg-background circuit-overlay flex items-center justify-center p-4">
      <Card className="w-full max-w-lg glass">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Terima kasih</CardTitle>
          <CardDescription>
            Jika kamu sudah bayar, klik tombol "Saya sudah bayar" di dashboard untuk mengirim konfirmasi ke merchant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(orderId || amount || status) ? (
            <div className="rounded-lg border bg-background/60 p-4 text-sm">
              {orderId ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">order_id</span>
                  <span className="font-mono">{orderId}</span>
                </div>
              ) : null}
              {amount ? (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">amount</span>
                  <span className="font-mono">{amount}</span>
                </div>
              ) : null}
              {status ? (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">status</span>
                  <span className="font-mono">{status}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard">
              <Button>Ke Dashboard</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline">Login</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">Beranda</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

