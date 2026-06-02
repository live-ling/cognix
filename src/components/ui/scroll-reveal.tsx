import { useScrollReveal } from "@/hooks/useScrollReveal"
import { cn } from "@/lib/utils"

interface ScrollRevealProps {
  children: React.ReactNode
  /** 动画类型 */
  animation?: "block-stack" | "fade-up" | "fade-scale" | "hotbar-slide"
  /** 延迟类名，如 "delay-100" */
  delay?: string
  /** 额外类名 */
  className?: string
  /** IntersectionObserver 阈值 */
  threshold?: number
}

/**
 * 滚动驱动入场动画包装器
 * 元素进入视口时自动播放指定动画
 */
export function ScrollReveal({
  children,
  animation = "fade-up",
  delay,
  className,
  threshold = 0.15,
}: ScrollRevealProps) {
  const { ref, isRevealed } = useScrollReveal<HTMLDivElement>({ threshold })

  return (
    <div
      ref={ref}
      className={cn(
        "scroll-reveal",
        isRevealed && `revealed anim-${animation}`,
        delay,
        className
      )}
    >
      {children}
    </div>
  )
}
