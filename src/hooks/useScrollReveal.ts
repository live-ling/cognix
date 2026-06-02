import { useEffect, useRef, useState } from "react"

interface UseScrollRevealOptions {
  /** 触发阈值 (0-1)，元素可见比例 */
  threshold?: number
  /** 根元素边距 */
  rootMargin?: string
  /** 只触发一次 */
  once?: boolean
}

/**
 * 滚动驱动入场动画 Hook
 * 使用 IntersectionObserver 检测元素可见性
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollRevealOptions = {}
) {
  const { threshold = 0.15, rootMargin = "0px 0px -50px 0px", once = true } = options
  const ref = useRef<T>(null)
  const [isRevealed, setIsRevealed] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // 如果服务端渲染或用户偏好减少动画，立即显示
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      setIsRevealed(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsRevealed(true)
          if (once) {
            observer.unobserve(element)
          }
        } else if (!once) {
          setIsRevealed(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold, rootMargin, once])

  return { ref, isRevealed }
}
