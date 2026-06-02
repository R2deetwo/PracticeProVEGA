import * as React from 'react';

const buttonVariants = {
  variant: {
    primary: "bg-primary-600 text-white hover:bg-primary-700 dark:hover:bg-primary-500",
    destructive: "bg-red-600 text-white hover:bg-red-700 dark:hover:bg-red-500",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-600",
    ghost: "hover:bg-slate-100 dark:hover:bg-zinc-700",
  },
  size: {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10 flex items-center justify-center",
  },
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants.variant;
  size?: keyof typeof buttonVariants.size;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', ...props }, ref) => {
    const classes = `inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-50
      ${buttonVariants.variant[variant]}
      ${buttonVariants.size[size]}
      ${className || ''}
    `;
    return <button className={classes} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button };