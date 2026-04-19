import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  as: As = "div",
  id,
}: {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
  id?: string;
}) {
  return (
    <As
      id={id}
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white",
        className,
      )}
    >
      {children}
    </As>
  );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-6 border-b border-[var(--color-border)]", className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={cn("text-base font-semibold text-[var(--color-ink)]", className)}>{children}</h3>;
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-6", className)}>{children}</div>;
}
