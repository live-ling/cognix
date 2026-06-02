import { cn } from "@/lib/utils"

interface SkeletonProps {
  type?: "text" | "title" | "avatar" | "card" | "custom"
  height?: string | number
  width?: string | number
  rounded?: "none" | "sm" | "md" | "lg" | "full" | number
  className?: string
  blockBuild?: boolean
  delay?: number
}

const roundedClasses = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
}

export function Skeleton({
  type = "text",
  height,
  width,
  rounded = "md",
  className,
  blockBuild = false,
  delay = 0,
}: SkeletonProps) {
  const baseClasses = "skeleton bg-muted"

  let defaultHeight = "1em"
  let defaultWidth = "100%"
  let defaultRounded = "md"

  switch (type) {
    case "title":
      defaultHeight = "1.5em"
      defaultWidth = "60%"
      break
    case "avatar":
      defaultHeight = "48px"
      defaultWidth = "48px"
      defaultRounded = "full"
      break
    case "card":
      defaultHeight = "180px"
      break
    case "custom":
      break
    default:
      break
  }

  const finalHeight = height ?? defaultHeight
  const finalWidth = width ?? defaultWidth

  const style = {
    height: typeof finalHeight === "number" ? `${finalHeight}px` : finalHeight,
    width: typeof finalWidth === "number" ? `${finalWidth}px` : finalWidth,
    animationDelay: `${delay}ms`,
  }

  return (
    <div
      className={cn(
        baseClasses,
        typeof rounded === "string" && roundedClasses[rounded as keyof typeof roundedClasses],
        blockBuild && "anim-block-place",
        className
      )}
      style={{
        ...style,
        ...(typeof rounded === "number" ? { borderRadius: `${rounded}px` } : {}),
      }}
    />
  )
}

interface SkeletonGroupProps {
  layout?: "card" | "list" | "profile" | "grid"
  count?: number
  className?: string
}

export function SkeletonGroup({ layout = "card", count = 1, className }: SkeletonGroupProps) {
  const skeletons = []

  switch (layout) {
    case "card":
      for (let i = 0; i < count; i++) {
        skeletons.push(
          <div key={i} className="space-y-3 anim-fade-up" style={{ animationDelay: `${i * 100}ms` }}>
            <Skeleton type="card" rounded="lg" />
            <div className="space-y-2">
              <Skeleton type="title" width="70%" />
              <Skeleton type="text" />
              <Skeleton type="text" width="85%" />
            </div>
          </div>
        )
      }
      break

    case "list":
      for (let i = 0; i < count; i++) {
        skeletons.push(
          <div key={i} className="flex gap-3 items-center p-3 anim-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
            <Skeleton type="avatar" />
            <div className="flex-1 space-y-2">
              <Skeleton type="text" width="60%" />
              <Skeleton type="text" width="40%" />
            </div>
          </div>
        )
      }
      break

    case "profile":
      skeletons.push(
        <div className="space-y-4 anim-fade-scale">
          <div className="flex flex-col items-center">
            <Skeleton type="avatar" rounded="full" height={96} width={96} />
            <Skeleton type="title" width="40%" className="mt-4" />
            <Skeleton type="text" width="60%" />
          </div>
          <div className="space-y-2">
            <Skeleton type="text" />
            <Skeleton type="text" />
            <Skeleton type="text" width="80%" />
          </div>
        </div>
      )
      break

    case "grid":
      for (let i = 0; i < count; i++) {
        skeletons.push(
          <div key={i} className="space-y-2 anim-block-stack" style={{ animationDelay: `${i * 50}ms` }}>
            <Skeleton height="120px" rounded="lg" />
            <Skeleton type="text" width="70%" />
            <Skeleton type="text" width="50%" />
          </div>
        )
      }
      break
  }

  return <div className={cn("space-y-4", className)}>{skeletons}</div>
}
