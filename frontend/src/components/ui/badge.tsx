import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#3399ff]/20 text-[#70baff] border border-[#3399ff]/40",
        secondary:
          "border-transparent bg-[#2d2d2d] text-[#b0b0b0]",
        destructive:
          "border-transparent bg-rose-500/20 text-rose-300 border border-rose-500/30",
        success:
          "border-transparent bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
        warning:
          "border-transparent bg-amber-500/20 text-amber-300 border border-amber-500/30",
        outline: "border border-[#3a3a3a] text-[#c0c0c0]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
