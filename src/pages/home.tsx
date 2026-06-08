import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, BarChart3, FileText, Target, Lightbulb, Brain, LogIn, Users, Globe } from 'lucide-react';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { CacheManager } from '@/lib/cache';
import { useSaying } from '@/hooks/use-saying';
import type { DashboardStats } from '@/lib/types';

interface SiteStats {
  bank_count: number;
  total_questions: number;
  today_answered: number;
  user_count: number;
}

const features = [
  {
    icon: BookOpen,
    title: '题库管理',
    desc: '创建和管理题库，支持多种题型和难度分类，让题目组织井井有条。',
    link: '/banks',
  },
  {
    icon: FileText,
    title: '智能导入',
    desc: '批量导入题目，自动识别题型和答案，大幅提升题目录入效率。',
    link: '/banks',
  },
  {
    icon: Target,
    title: '错题复习',
    desc: '自动记录错题，智能推送薄弱知识点，针对性强化训练。',
    link: '/mistakes',
  },
  {
    icon: BarChart3,
    title: '多维统计',
    desc: '学习热力图、正确率趋势、用时分析，全方位掌握学习进度。',
    link: '/profile',
  },
  {
    icon: Lightbulb,
    title: '模拟考试',
    desc: '自由设置题目数量和模式，模拟真实考试环境，提升应试能力。',
    link: '/practice',
  },
  {
    icon: Brain,
    title: '智能推荐',
    desc: '基于答题表现智能推荐练习内容，科学提升学习效率。',
    link: '/practice',
  },
];

export function Home() {
  const { user } = useSupabaseAuth();
  const saying = useSaying();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [siteStats, setSiteStats] = useState<SiteStats | null>(null);
  const [showSiteStats, setShowSiteStats] = useState(true);

  useEffect(() => {
    if (!user) return;
    const cached = CacheManager.get<DashboardStats>('home_stats');
    if (cached) { setStats(cached); return; }
    supabase.rpc('get_dashboard_stats').then(({ data, error }) => {
        if (!error && data) {
          setStats(data as DashboardStats);
          CacheManager.set('home_stats', data, 5 * 60 * 1000);
        }
      });
  }, [user]);

  // Fetch site-wide stats
  useEffect(() => {
    supabase.rpc('get_site_stats').then(({ data, error }) => {
      if (!error && data) {
        setSiteStats(data as SiteStats);
      }
    });
  }, []);

  const displayStats = showSiteStats && siteStats
    ? { bank_count: siteStats.bank_count, total_questions: siteStats.total_questions, today_answered: siteStats.today_answered }
    : stats;

  return (
    <div className="min-h-screen">
      {/* Hero Section — full viewport height */}
      <section className="hero-bg relative overflow-hidden min-h-screen flex items-center">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 w-full">
          <div className="max-w-2xl space-y-6">
            {/* Status */}
            <div className="server-online text-sm">
              系统就绪
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              欢迎来到 <span className="gradient-text">Cognix</span>
            </h1>

            {/* Description */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              智能题库练习平台，让每一次练习都高效且有收获。
              支持多种题型、智能错题分析、学习数据追踪。
            </p>

            {/* 一言 */}
            {saying.text && (
              <div className="flex items-start gap-2 max-w-xl">
                <p className="text-sm text-muted-foreground/70 italic leading-relaxed">{saying.text}</p>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-3 pt-4">
              {user ? (
                <>
                  <Link to="/practice">
                    <EnhancedButton variant="success" size="xl" effect="lift">
                      开始练习
                    </EnhancedButton>
                  </Link>
                  <Link to="/banks">
                    <EnhancedButton variant="outline" size="xl">
                      管理题库
                    </EnhancedButton>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <EnhancedButton variant="success" size="xl" effect="lift">
                      <LogIn className="h-4 w-4 mr-2" />
                      登录 / 注册
                    </EnhancedButton>
                  </Link>
                  <Link to="/login">
                    <EnhancedButton variant="outline" size="xl">
                      开始使用
                    </EnhancedButton>
                  </Link>
                </>
              )}
            </div>

            {/* Quick stats — click to toggle personal / site-wide */}
            <div
              className="flex items-center gap-8 pt-8 text-sm cursor-pointer group"
              onClick={() => setShowSiteStats(!showSiteStats)}
              title={showSiteStats ? '点击查看个人统计' : '点击查看全站统计'}
            >
              {/* Toggle badge — left side */}
              <div className="flex-shrink-0">
                {showSiteStats ? (
                  <span className="inline-flex items-center gap-1 text-xs text-primary/70 bg-primary/5 px-2 py-1.5 rounded-full">
                    <Globe className="h-3 w-3" />全站
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1.5 rounded-full">
                    <Users className="h-3 w-3" />个人
                  </span>
                )}
              </div>
              <div className="transition-all duration-200 group-hover:scale-105">
                <p className="text-2xl font-bold text-primary">{displayStats?.bank_count ?? 0}+</p>
                <p className="text-muted-foreground">题库数量</p>
              </div>
              <div className="transition-all duration-200 group-hover:scale-105">
                <p className="text-2xl font-bold text-primary">{displayStats?.total_questions ?? 0}+</p>
                <p className="text-muted-foreground">题目总数</p>
              </div>
              <div className="transition-all duration-200 group-hover:scale-105">
                <p className="text-2xl font-bold text-primary">{displayStats?.today_answered ?? 0}+</p>
                <p className="text-muted-foreground">今日答题</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-8 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
            强大功能，助力学习
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            从题库管理到智能练习，Cognix 为你提供全方位的刷题体验
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((item, i) => {
            const delays = ['delay-0', 'delay-75', 'delay-150', 'delay-200', 'delay-300', 'delay-500'];
            return (
              <ScrollReveal key={item.title} animation="block-stack" delay={delays[i]}>
                <Link to={item.link}>
                  <Card className="hover-lift h-full p-6 border-border/60 cursor-pointer">
                    <div className="flex flex-col items-start text-left gap-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="mb-2 text-base">{item.title}</CardTitle>
                        <CardDescription className="leading-relaxed">{item.desc}</CardDescription>
                      </div>
                    </div>
                  </Card>
                </Link>
              </ScrollReveal>
            );
          })}
        </div>
      </section>
    </div>
  );
}
