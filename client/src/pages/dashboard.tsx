import { useQuery } from "@tanstack/react-query";
import { Key, CheckCircle, XCircle, DollarSign, Activity, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Key as KeyType, Log } from "@shared/schema";

interface DashboardStats {
  totalKeys: number;
  activeKeys: number;
  expiredKeys: number;
  unusedKeys: number;
  totalRevenue: string;
  recentActivations: (Log & { key?: KeyType })[];
  chartData: { date: string; activations: number }[];
}

function formatIdr(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(String(value).replace(/,/g, "")) || 0 : Number(value);
  return new Intl.NumberFormat("id-ID").format(n);
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  loading,
}: {
  title: string;
  value: string | number;
  icon: any;
  description?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="font-serif text-3xl font-bold" data-testid={`stat-${title.toLowerCase().replace(" ", "-")}`}>
              {value}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge variant="default" className="bg-chart-2">Active</Badge>;
    case "expired":
      return <Badge variant="destructive">Expired</Badge>;
    case "available":
    case "unused":
      return <Badge variant="secondary">Available</Badge>;
    case "sold":
      return <Badge variant="outline">Sold</Badge>;
    case "blacklisted":
      return <Badge variant="outline" className="border-destructive text-destructive">Blacklisted</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: stockData, isLoading: stockLoading } = useQuery<{
    items: Array<{
      id: number;
      title: string;
      durationDays: number;
      price: string;
      exactAvailable: number;
      genericAvailable: number;
      totalAvailable: number;
    }>;
  }>({
    queryKey: ["/api/stocks/packages"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-wide" data-testid="text-page-title">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Overview of your key management system
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Keys"
          value={stats?.totalKeys ?? 0}
          icon={Key}
          loading={isLoading}
        />
        <StatCard
          title="Active Keys"
          value={stats?.activeKeys ?? 0}
          icon={CheckCircle}
          loading={isLoading}
        />
        <StatCard
          title="Expired Keys"
          value={stats?.expiredKeys ?? 0}
          icon={XCircle}
          loading={isLoading}
        />
        <StatCard
          title="Total Revenue"
          value={`$${stats?.totalRevenue ?? "0.00"}`}
          icon={DollarSign}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Key Activations
            </CardTitle>
            <CardDescription>Last 30 days activation trend</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.chartData ?? []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="activations"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary) / 0.2)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activations
            </CardTitle>
            <CardDescription>Latest key activation events</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : stats?.recentActivations?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentActivations.slice(0, 5).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {log.key?.keyCode?.slice(0, 9) || "N/A"}...
                      </TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(log.timestamp).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                No recent activations
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sisa Stok per Package</CardTitle>
          <CardDescription>Jumlah key available (package-specific + generic yang match)</CardDescription>
        </CardHeader>
        <CardContent>
          {stockLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Exact</TableHead>
                  <TableHead>Generic</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stockData?.items || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Belum ada data stok.
                    </TableCell>
                  </TableRow>
                ) : (
                  (stockData?.items || []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.title}</div>
                        <div className="text-xs text-muted-foreground">{s.durationDays} hari</div>
                      </TableCell>
                      <TableCell>IDR {formatIdr(s.price)}</TableCell>
                      <TableCell>{s.exactAvailable}</TableCell>
                      <TableCell>{s.genericAvailable}</TableCell>
                      <TableCell>
                        <Badge variant={s.totalAvailable > 0 ? "secondary" : "outline"}>{s.totalAvailable}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
