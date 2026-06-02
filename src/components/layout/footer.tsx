import { Link } from "react-router-dom"

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-[1400px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link to="/">
          <img src="/logo.png" alt="Cognix" className="h-7 w-auto" />
        </Link>

        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Cognix. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
