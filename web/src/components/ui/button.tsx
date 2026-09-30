import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

export function Button({
  children,
  className = '',
  type = 'button',
  variant = 'secondary',
  ...props
}: ButtonProps) {
  const variantClasses =
    variant === 'primary'
      ? 'border border-sky-400 bg-sky-500 text-slate-950 hover:bg-sky-400'
      : 'border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500 hover:bg-slate-800';

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium shadow-sm ${variantClasses} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
