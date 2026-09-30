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
      ? 'border border-neutral-100 bg-neutral-100 text-neutral-950 hover:bg-white'
      : 'border border-neutral-700 bg-neutral-900 text-neutral-100 hover:border-neutral-500 hover:text-neutral-50';

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
