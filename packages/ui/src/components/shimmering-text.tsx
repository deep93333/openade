import React, { useMemo, useRef } from "react"
import { motion, useInView, type UseInViewOptions } from "framer-motion"

import { cn } from "../lib/utils"

type ShimmeringTextProps = {
  text: string
  duration?: number
  delay?: number
  repeat?: boolean
  repeatDelay?: number
  className?: string
  startOnView?: boolean
  once?: boolean
  inViewMargin?: UseInViewOptions["margin"]
  spread?: number
  color?: string
  shimmerColor?: string
}

export function ShimmeringText({
  text,
  duration = 2,
  delay = 0,
  repeat = true,
  repeatDelay = 0.5,
  className,
  startOnView = true,
  once = false,
  inViewMargin,
  spread = 2,
  color,
  shimmerColor,
}: ShimmeringTextProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once, margin: inViewMargin })

  const dynamicSpread = useMemo(() => text.length * spread, [text, spread])

  const shouldAnimate = !startOnView || isInView

  return (
    <motion.span
      ref={ref}
      className={cn(
        "relative inline-block bg-clip-text text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent]",
        "[--base-color:var(--color-muted-foreground)] [--shimmer-color:var(--color-foreground)]",
        "dark:[--base-color:var(--color-muted-foreground)] dark:[--shimmer-color:var(--color-foreground)]",
        className,
      )}
      style={
        {
          ...(color && { "--base-color": color }),
          ...(shimmerColor && { "--shimmer-color": shimmerColor }),
          backgroundImage: `linear-gradient(90deg, transparent calc(50% - ${dynamicSpread}px), var(--shimmer-color), transparent calc(50% + ${dynamicSpread}px)), linear-gradient(var(--base-color), var(--base-color))`,
          backgroundSize: "250% 100%, auto",
          backgroundRepeat: "no-repeat, repeat",
        } as React.CSSProperties
      }
      initial={{ backgroundPosition: "100% center", opacity: 0 }}
      animate={
        shouldAnimate
          ? { backgroundPosition: "0% center", opacity: 1 }
          : {}
      }
      transition={{
        backgroundPosition: {
          repeat: repeat ? Infinity : 0,
          repeatType: "reverse",
          duration,
          delay,
          repeatDelay,
          ease: "linear",
        },
        opacity: { duration: 0.3, delay },
      }}
    >
      {text}
    </motion.span>
  )
}
