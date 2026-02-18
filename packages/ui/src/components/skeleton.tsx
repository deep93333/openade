import { cn } from "../lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-md bg-secondary relative overflow-hidden", className)} {...props}>
      <div
        className="absolute inset-0 bg-linear-to-r from-transparent via-foreground/5 to-transparent"
        style={{
          animation: "shimmer 1.5s infinite",
        }}
      />
      <style>
        {`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}
      </style>
    </div>
  );
}

export { Skeleton };
