import { cn } from "../lib/utils";
import type { IconProps } from "./types";

export const LlmChatAnimatedIcon = ({ className }: IconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4", className)}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <style>
          {`
            @keyframes sparkle-in {
              0% {
                opacity: 0;
                transform: translate(0, 0);
              }
              100% {
                opacity: 1;
                transform: translate(0, 0);
              }
            }

            @keyframes sparkle-out {
              0% {
                opacity: 1;
                transform: translate(0, 0);
              }
              100% {
                opacity: 0;
                transform: translate(0, 0);
              }
            }

            .dot-animation {
              animation: sparkle-in 0.6s ease-in-out forwards, sparkle-out 0.6s ease-in-out forwards;
              animation-iteration-count: infinite;
            }

            .dot-center {
              animation-delay: 0s, 3.8s;
            }
            .dot-ring1-1 {
              animation-delay: 0.2s, 3.6s;

            }
            .dot-ring1-2 {
              animation-delay: 0.2s, 3.6s;


            }
            .dot-ring1-3 {
              animation-delay: 0.2s, 3.6s;


            }
            .dot-ring1-4 {
              animation-delay: 0.2s, 3.6s;


            }
            .dot-ring2-1 {
              animation-delay: 0.4s, 3.4s;


            }
            .dot-ring2-2 {
              animation-delay: 0.4s, 3.4s;


            }
            .dot-ring2-3 {
              animation-delay: 0.4s, 3.4s;


            }
            .dot-ring2-4 {
              animation-delay: 0.4s, 3.4s;


            }
            .dot-ring2-5 {
              animation-delay: 0.4s, 3.4s;


            }
            .dot-ring2-6 {
              animation-delay: 0.4s, 3.4s;


            }
            .dot-ring2-7 {
              animation-delay: 0.4s, 3.4s;


            }
            .dot-ring2-8 {
              animation-delay: 0.4s, 3.4s;


            }
            .dot-ring3-1 {
              animation-delay: 0.6s, 3.2s;


            }
            .dot-ring3-2 {
              animation-delay: 0.6s, 3.2s;


            }
            .dot-ring3-3 {
              animation-delay: 0.6s, 3.2s;


            }
            .dot-ring3-4 {
              animation-delay: 0.6s, 3.2s;


            }
          `}
        </style>
      </defs>

      <rect
        x="87.4995"
        y="0"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring3-1"
      />
      <rect
        x="0"
        y="87.4998"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring3-2"
      />
      <rect
        x="175"
        y="87.4998"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring3-3"
      />
      <rect
        x="87.4995"
        y="112.5"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring1-1"
      />
      <rect
        x="137.5"
        y="62.5"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring2-1"
      />
      <rect
        x="62.5"
        y="137.5"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring2-2"
      />
      <rect
        x="87.4995"
        y="175"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring3-4"
      />
      <rect
        x="62.5"
        y="37.5"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring2-3"
      />
      <rect
        x="87.4995"
        y="62.5"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring1-2"
      />
      <rect
        x="112.5"
        y="37.5"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring2-4"
      />
      <rect
        x="112.5"
        y="87.4998"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring1-4"
      />
      <rect
        x="37.4995"
        y="62.5"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring2-5"
      />
      <rect
        x="37.4995"
        y="112.5"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring2-6"
      />
      <rect
        x="137.5"
        y="112.5"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring2-7"
      />
      <rect
        x="62.5"
        y="87.4998"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring1-3"
      />
      <rect
        x="113.281"
        y="137.5"
        width="25"
        height="25"
        rx="6"
        fill="currentColor"
        className="dot-animation dot-ring2-8"
      />
    </svg>
  );
};
