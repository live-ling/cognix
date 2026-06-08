import { Link, useLocation, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Menu, X, Sun, Moon, User, LogOut, ChevronDown } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useTheme } from "@/contexts/ThemeContext"
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext"
import { UserAvatar } from "@/components/user-avatar"

const navLinks = [
  { to: "/", label: "首页" },
  { to: "/square", label: "广场" },
  { to: "/profile", label: "我的" },
  { to: "/banks", label: "题库" },
  { to: "/practice", label: "练习" },
  { to: "/mistakes", label: "错题本" },
]

// Routes that should hide nav links
const NO_NAV_ROUTES: string[] = []

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useSupabaseAuth()
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // Close user menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const isHomeTop = location.pathname === "/" && !scrolled
  const hideNav = NO_NAV_ROUTES.includes(location.pathname)

  const handleLogout = () => {
    logout()
    setUserMenuOpen(false)
    navigate("/login", { replace: true })
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "glass-nav"
          : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="max-w-[1400px] mx-auto flex items-center justify-between h-14 px-6">
        {/* Logo */}
        <Link to="/">
          <img src="/logo.png" alt="Cognix" className="h-8 w-auto" />
        </Link>

        {/* Desktop nav */}
        {!hideNav && (
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  location.pathname === link.to
                    ? isHomeTop
                      ? "bg-accent/70 text-accent-foreground font-medium"
                      : "bg-accent text-accent-foreground font-medium"
                    : isHomeTop
                      ? "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2">
          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className={cn(
              "h-9 w-9 inline-flex items-center justify-center rounded-md transition-colors",
              isHomeTop
                ? "hover:bg-accent/50 text-foreground"
                : "hover:bg-accent text-muted-foreground hover:text-foreground"
            )}
            aria-label="切换主题"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* User menu or login button */}
          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={cn(
                  "flex items-center gap-2 h-9 px-3 rounded-md transition-colors",
                  isHomeTop
                    ? "hover:bg-accent/50"
                    : "hover:bg-accent"
                )}
              >
                <UserAvatar name={user.name} email={user.email} avatarUrl={user.avatar_url} size="sm" />
                <span className="text-sm font-medium max-w-[100px] truncate">{user.name}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-background border border-border rounded-lg shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    个人主页
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left hover:bg-accent transition-colors text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className={cn(
                "h-9 px-4 inline-flex items-center text-sm font-medium rounded-md transition-colors",
                isHomeTop
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              登录
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className={cn(
            "md:hidden p-2 rounded-md transition-colors",
            isHomeTop ? "hover:bg-accent/50" : "hover:bg-accent"
          )}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-background/80 backdrop-blur-xl">
          <nav className="flex flex-col p-4 gap-1">
            {!hideNav && navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "px-3 py-2 text-sm rounded-md transition-colors",
                  location.pathname === link.to
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {link.label}
              </Link>
            ))}
            {!hideNav && <hr className="my-2 border-border" />}
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  个人主页
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-2 text-sm rounded-md text-destructive hover:bg-accent/50 flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  退出登录
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-3 py-2 text-sm rounded-md text-primary font-medium hover:bg-accent/50 flex items-center gap-2"
              >
                登录
              </Link>
            )}
            <hr className="my-2 border-border" />
            <button
              type="button"
              onClick={toggleTheme}
              className="px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 flex items-center gap-2"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              切换主题
            </button>
          </nav>
        </div>
      )}
    </header>
  )
}
