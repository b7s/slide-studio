import * as React from "react";
import {Slot} from "@radix-ui/react-slot";
import {cva} from "class-variance-authority";

import {cn} from "../lib/utils";

const buttonVariants = cva(
  "btn [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
  variants: {
    variant: {
      default: "btn-default",
      destructive: "btn-destructive",
      outline: "btn-outline",
      secondary: "btn-secondary",
      ghost: "btn-ghost",
      save: "btn-save",
      highlight: "btn-highlight",
    },
    size: {
      default: "",
      sm: "btn-sm",
      lg: "btn-lg",
      icon: "btn-icon",
      "icon-sm": "btn-icon-sm",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
