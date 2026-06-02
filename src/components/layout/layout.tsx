import { useEffect, useRef } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Header } from "./header"
import { Footer } from "./footer"

// Routes that should not show header/footer
const FULLSCREEN_ROUTES = ['/login']
// Routes that should not show footer
const NO_FOOTER_ROUTES = ['/profile', '/change-password']

export function Layout() {
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const isFullscreen = FULLSCREEN_ROUTES.includes(location.pathname)
  const hideFooter = NO_FOOTER_ROUTES.includes(location.pathname)

  // 路由切换时触发页面过渡动画
  useEffect(() => {
    const main = mainRef.current
    if (!main) return

    main.classList.remove("page-exit")
    main.classList.add("page-enter")

    return () => {
      main.classList.remove("page-enter")
    }
  }, [location.pathname])

  if (isFullscreen) {
    return <Outlet />
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main ref={mainRef} className="flex-1">
        <Outlet />
      </main>
      {!hideFooter && <Footer />}
    </div>
  )
}
