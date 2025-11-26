// /frontend/src/oneopoly/components/ui.tsx
import React from "react";

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  isLoading?: boolean;
}

export const NeonButton: React.FC<NeonButtonProps> = ({
  children,
  variant = "primary",
  className = "",
  disabled,
  isLoading,
  ...props
}) => {
  const baseStyles =
    "relative px-6 py-3 rounded-xl font-display font-bold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-neon-cyan text-background hover:shadow-neon hover:-translate-y-0.5 border border-neon-cyan",
    secondary: "bg-transparent border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10 hover:border-neon-cyan",
    ghost: "bg-transparent text-text-secondary hover:text-white hover:bg-white/5",
    danger: "bg-transparent border border-accent-rose text-accent-rose hover:bg-accent-rose/10 hover:shadow-[0_0_15px_rgba(251,113,133,0.3)]",
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} disabled={disabled || isLoading} {...props}>
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {children}
    </button>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`bg-surface border border-border rounded-2xl shadow-lg backdrop-blur-sm ${className}`}>{children}</div>
);

export const Badge: React.FC<{ children: React.ReactNode; type?: "success" | "warning" | "error" | "neutral" }> = ({
  children,
  type = "neutral",
}) => {
  const colors = {
    success: "bg-accent-green/20 text-accent-green border-accent-green/30",
    warning: "bg-accent-amber/20 text-accent-amber border-accent-amber/30",
    error: "bg-accent-rose/20 text-accent-rose border-accent-rose/30",
    neutral: "bg-white/10 text-text-secondary border-white/20",
  };

  return <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${colors[type]}`}>{children}</span>;
};
