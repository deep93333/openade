"use client";
import { Toaster as Sonner } from "sonner";
import { AlertIcon, CircleCheckIcon, ErrorIcon, InfoCircleIcon, Spinner1Icon } from "../icons";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      className="flex justify-center toaster group dark w-fit"
      offset={64}
      toastOptions={{
        style: {
          width: "fit-content",
        },

        classNames: {
          toast:
            "dark group w-fit toast group-[.toaster]:bg-popover/90 group-[.toaster]:text-foreground border-none ring-1 ring-blue-500 group-[.toaster]:border-none group-[.toaster]:ring-1 group-[.toaster]:text-foreground group-[.toaster]:ring-foreground/10 ",
          description: "group-[.toast]:text-muted-foreground pr-3",
          title: "group-[.toast]:text-foreground pr-3",
          actionButton:
            "group-[.toast]:bg-primary h-8 group-[.toast]:text-primary-foreground !rounded-[4px] !ml-6",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-5 text-accent" />,
        info: <InfoCircleIcon className="size-5 text-accent" />,
        warning: <AlertIcon className="size-5 text-accent" />,
        error: <ErrorIcon className="size-5 text-accent" />,
        loading: <Spinner1Icon className="size-5 text-accent animate-spin" />,
      }}
      {...props}
    />
  );
};

export { Toaster };
