import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle, Clock, Flame, Target, TrendingUp, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { CacheManager } from '@/lib/cache';
import { useAuth } from '@/contexts/AuthContext';
import type { DashboardStats } from '@/lib/types';

const CACHE_KEY = 'dashboard_stats';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(() => {
    return CacheManager.get<DashboardStats>(CACHE_KEY);
  });
  const [loading, setLoading] = useState(!stats);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stats) return; // Already have cached data
    setLoading(true);
    setError(null);
    api<DashboardStats>('/stats/dashboard')
      .then((data) => {
        setStats(data);
        CacheManager.set(CACHE_KEY, data, CACHE_TTL);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <div className="dash-banner">
          <Skeleton type="title" width="40%" className="mb-2" />
          <Skeleton type="text" width="60%" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton type="text" width="60%" className="mb-2" />
              <Skeleton type="title" width="40%" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <Card className="p-8 text-center">
          <p className="text-destructive font-medium mb-3">加载失败</p>
          <p className="text-muted-foreground text-sm mb-4">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>重试</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Banner */}
      <div className="dash-banner">
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">欢迎回来，{user?.name ?? '同学'} 👋</h1>
          <p className="text-muted-foreground">以下是你的学习概览，继续加油！</p>
          <div className="server-online mt-3 text-sm">系统运行中</div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 hover-lift">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.today_answered ?? 0}</p>
              <p className="text-xs text-muted-foreground">今日答题</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 hover-lift">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {stats?.accuracy != null ? `${(stats.accuracy * 100).toFixed(0)}%` : '0%'}
              </p>
              <p className="text-xs text-muted-foreground">正确率</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 hover-lift">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.streak_days ?? 0} 天</p>
              <p className="text-xs text-muted-foreground">连续学习</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 hover-lift">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.bank_count ?? 0}</p>
              <p className="text-xs text-muted-foreground">题库总数</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Heatmap + Recent */}
        <div className="lg:col-span-2 space-y-6">
          {/* Heatmap */}
          <Card>
            <CardHeader className="section-header">
              <CardTitle>学习热力图</CardTitle>
            </CardHeader>
            <CardContent>
              <HeatmapGrid data={stats?.heatmap} />
            </CardContent>
          </Card>

          {/* Recent Sessions */}
          <Card>
            <CardHeader className="section-header">
              <CardTitle>最近练习记录</CardTitle>
              <Link to="/practice" className="action-link">更多 →</Link>
            </CardHeader>
            <CardContent>
              {stats?.recent_sessions && stats.recent_sessions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">日期</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">模式</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">正确率</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">用时</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recent_sessions.map((s, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                          <td className="py-2 px-3">{s.date}</td>
                          <td className="py-2 px-3 capitalize">{s.mode ?? '-'}</td>
                          <td className="py-2 px-3">
                            <Badge variant={s.accuracy >= 0.8 ? 'success' : s.accuracy >= 0.6 ? 'warning' : 'destructive'}>
                              {s.correct}/{s.total} ({(s.accuracy * 100).toFixed(0)}%)
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{s.duration ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">暂无练习记录</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Actions + Overview */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">快捷操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/practice" className="flex items-center gap-2 p-3 rounded-md hover:bg-accent transition-colors group">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium group-hover:text-primary transition-colors">开始练习</span>
              </Link>
              <Link to="/banks" className="flex items-center gap-2 p-3 rounded-md hover:bg-accent transition-colors group">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium group-hover:text-primary transition-colors">管理题库</span>
              </Link>
              <Link to="/mistakes" className="flex items-center gap-2 p-3 rounded-md hover:bg-accent transition-colors group">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium group-hover:text-primary transition-colors">错题复习</span>
              </Link>
            </CardContent>
          </Card>

          {/* Data Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">数据概览</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="info-row">
                <div className="info-row-icon">
                  <FileTextIcon className="h-4 w-4" />
                </div>
                <div className="info-row-content">
                  <p className="info-row-label">总题目数</p>
                  <p className="info-row-value">{stats?.total_questions ?? 0}</p>
                </div>
              </div>
              <div className="info-row">
                <div className="info-row-icon">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="info-row-content">
                  <p className="info-row-label">平均正确率</p>
                  <p className="info-row-value">
                    {stats?.avg_accuracy != null ? `${(stats.avg_accuracy * 100).toFixed(1)}%` : '-'}
                  </p>
                </div>
              </div>
              <div className="info-row">
                <div className="info-row-icon">
                  <Clock className="h-4 w-4" />
                </div>
                <div className="info-row-content">
                  <p className="info-row-label">最长连续</p>
                  <p className="info-row-value">{stats?.max_streak ?? 0} 天</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// GitHub-style horizontal heatmap: 7 rows (Sun-Sat) × N columns (weeks)
function HeatmapGrid({ data }: { data?: { date: string; count: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">暂无学习记录</p>
    );
  }

  // Build a date→count map for quick lookup
  const countMap = new Map<string, number>();
  for (const d of data) countMap.set(d.date, d.count);

  // Show last 26 weeks (~6 months) aligned to Sunday
  const today = new Date();
  const WEEKS = 26;
  const todayDay = today.getDay(); // 0=Sun
  const endSunday = new Date(today);
  endSunday.setDate(endSunday.getDate() - todayDay);
  const startSunday = new Date(endSunday);
  startSunday.setDate(startSunday.getDate() - (WEEKS - 1) * 7);

  // Build columns (weeks)
  const columns: { date: string; count: number }[][] = [];
  const cursor = new Date(startSunday);
  for (let w = 0; w < WEEKS; w++) {
    const week: { date: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const ds = cursor.toISOString().slice(0, 10);
      week.push({ date: ds, count: countMap.get(ds) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(week);
  }

  // Month labels: show label when the 1st of a month falls in that column's first day
  const monthLabels: (string | null)[] = columns.map((week) => {
    const first = week[0].date;
    const day = parseInt(first.slice(8, 10), 10);
    if (day <= 7) {
      const month = parseInt(first.slice(5, 7), 10);
      return ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'][month];
    }
    return null;
  });

  const dayLabels = ['日', '', '二', '', '四', '', '六'];

  const getColor = (count: number) => {
    if (count === 0) return 'bg-muted/40 dark:bg-muted/30';
    if (count <= 2) return 'bg-primary/20';
    if (count <= 5) return 'bg-primary/40';
    if (count <= 10) return 'bg-primary/60';
    return 'bg-primary/80';
  };

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-0.5 select-none">
        {/* Month labels */}
        <div className="flex gap-0.5 ml-6 mb-1">
          {monthLabels.map((label, i) => (
            <div key={i} className="w-[14px] text-[10px] text-muted-foreground text-center">
              {label ?? ''}
            </div>
          ))}
        </div>
        {/* Grid: day labels + cells */}
        <div className="flex gap-0.5">
          {/* Day-of-week labels */}
          <div className="flex flex-col gap-0.5 mr-1">
            {dayLabels.map((label, i) => (
              <div key={i} className="h-[14px] flex items-center">
                <span className="text-[10px] text-muted-foreground w-5 text-right leading-none">
                  {label}
                </span>
              </div>
            ))}
          </div>
          {/* Week columns */}
          {columns.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`w-[14px] h-[14px] rounded-[3px] transition-colors hover:ring-1 hover:ring-primary/50 ${getColor(day.count)}`}
                  title={`${day.date}: ${day.count} 题`}
                />
              ))}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-2 ml-7">
          <span className="text-[10px] text-muted-foreground">少</span>
          {['bg-muted/40 dark:bg-muted/30', 'bg-primary/20', 'bg-primary/40', 'bg-primary/60', 'bg-primary/80'].map((cls, i) => (
            <div key={i} className={`w-[12px] h-[12px] rounded-[2px] ${cls}`} />
          ))}
          <span className="text-[10px] text-muted-foreground">多</span>
        </div>
      </div>
    </div>
  );
}

// Simple icon component for overview
function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
