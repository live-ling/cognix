import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium gap-2 relative overflow-hidden transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg",
        destructive: "bg-destructive text-white hover:bg-destructive/90 shadow-md hover:shadow-lg",
        outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-[#22c55e] text-white hover:bg-[#16a34a] shadow-lg shadow-green-500/30 hover:shadow-green-500/40",
        accent: "bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-white hover:from-[#2563eb] hover:to-[#0891b2] shadow-lg shadow-cyan-500/30",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        xl: "h-12 rounded-lg px-10 text-base",
        icon: "h-9 w-9",
      },
      effect: {
        none: "",
        ripple: "btn-ripple",
        glow: "hover-glow",
        lift: "hover-lift",
        pulse: "pulse-redstone",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      effect: "ripple",
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
  blockBuild?: boolean
}

const EnhancedButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      effect,
      asChild = false,
      loading = false,
      loadingText,
      blockBuild = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    const [isBuilding, setIsBuilding] = React.useState(false)

    React.useEffect(() => {
      if (blockBuild && !isBuilding) {
        setIsBuilding(true)
        const timer = setTimeout(() => setIsBuilding(false), 500)
        return () => clearTimeout(timer)
      }
    }, [blockBuild, isBuilding])

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, effect, className }),
          loading && "relative text-transparent",
          isBuilding && "anim-block-place"
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-current opacity-60"
                      style={{
                        animation: `xp-bounce 1s ease-in-out infinite ${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
                <span className="text-current">{loadingText || "加载中"}</span>
              </div>
            </div>
            <span className="opacity-0">{children}</span>
          </>
        )}

        {!loading && children}

        {isBuilding && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-current rounded-full opacity-70"
                style={{
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  animation: `pick-particle 0.5s ease-out forwards`,
                  animationDelay: `${i * 0.05}s`,
                  "--px": `${Math.cos((i * 45) * Math.PI / 180) * 20}px`,
                  "--py": `${Math.sin((i * 45) * Math.PI / 180) * 20}px`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}
      </Comp>
    )
  }
)
EnhancedButton.displayName = "EnhancedButton"

export { EnhancedButton, buttonVariants }
