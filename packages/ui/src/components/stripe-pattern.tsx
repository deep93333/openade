import { cn } from "../lib/utils";

type StripePatternProps = {
  width?: string | number;
  height?: string | number;
  stripeColor?: string;
  backgroundColor?: string;
  stripeWidth?: string | number;
  stripeSpacing?: string | number;
  angle?: number;
  className?: string;
  variant?: "default" | "dense" | "shimmer";
  animate?: boolean;
};

export const StripePattern = ({
  width,
  height,
  stripeColor,
  backgroundColor,
  stripeWidth,
  stripeSpacing,
  angle = 45,
  className,
  variant = "default",
  animate = false,
}: StripePatternProps) => {
  const presets = {
    default: {
      stripeColor: stripeColor || "oklch(0.9 0 0)",
      backgroundColor: backgroundColor || "oklch(0.97 0 0)",
      stripeWidth: stripeWidth || "1px",
      stripeSpacing: stripeSpacing || "20px",
    },
    dense: {
      stripeColor: stripeColor || "oklch(0.92 0 0)",
      backgroundColor: backgroundColor || "oklch(0.95 0 0)",
      stripeWidth: stripeWidth || "1px",
      stripeSpacing: stripeSpacing || "8px",
    },
    shimmer: {
      stripeColor: stripeColor || "oklch(0.93 0 0)",
      backgroundColor: backgroundColor || "oklch(0.96 0 0)",
      stripeWidth: stripeWidth || "40px",
      stripeSpacing: stripeSpacing || "60px",
    },
  };

  const preset = presets[variant];

  const stripePattern = {
    backgroundImage: `repeating-linear-gradient(
      ${angle}deg,
      ${preset.backgroundColor} 0px,
      ${preset.backgroundColor} ${preset.stripeSpacing},
      ${preset.stripeColor} ${preset.stripeSpacing},
      ${preset.stripeColor} calc(${preset.stripeSpacing} + ${preset.stripeWidth}),
      ${preset.backgroundColor} calc(${preset.stripeSpacing} + ${preset.stripeWidth}),
      ${preset.backgroundColor} calc(${preset.stripeSpacing} * 2)
    )`,
    backgroundSize: variant === "shimmer" && animate ? "200% 200%" : undefined,
    animation: variant === "shimmer" && animate ? "shimmer 2s infinite linear" : undefined,
  };

  return (
    <>
      {variant === "shimmer" && animate && (
        <style>
          {`
            @keyframes shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
          `}
        </style>
      )}
      <div
        style={{
          width: width || "100%",
          height: height || "100%",
          ...stripePattern,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          transform: "translateZ(0)",
          WebkitTransform: "translateZ(0)",
        }}
        className={cn("relative", className)}
      />
    </>
  );
};
