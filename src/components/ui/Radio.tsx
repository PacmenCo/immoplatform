import { cn } from "@/lib/cn";

type RadioProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: React.ReactNode;
  description?: string;
  id: string;
};

export function Radio({
  label,
  description,
  id,
  className,
  ...props
}: RadioProps) {
  const descId = description ? `${id}-desc` : undefined;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={id}
        type="radio"
        aria-describedby={descId}
        className="mt-0.5 h-4 w-4 shrink-0 border border-[var(--color-border-strong)] bg-white accent-[var(--color-brand)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
        {...props}
      />
      <label htmlFor={id} className="flex flex-col gap-0.5 text-sm cursor-pointer select-none">
        <span className="font-medium text-[var(--color-ink)]">{label}</span>
        {description && (
          <span id={descId} className="text-xs text-[var(--color-ink-muted)]">
            {description}
          </span>
        )}
      </label>
    </div>
  );
}

type RadioOption = {
  value: string;
  label: string;
  description?: string;
};

type RadioGroupProps = {
  name: string;
  value?: string;
  options: RadioOption[];
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  className?: string;
  legend?: string;
};

export function RadioGroup({
  name,
  value,
  options,
  onChange,
  className,
  legend,
}: RadioGroupProps) {
  return (
    <fieldset className={cn("flex flex-col gap-3", className)}>
      {legend && (
        <legend className="text-sm font-medium text-[var(--color-ink)] mb-1">
          {legend}
        </legend>
      )}
      {options.map((opt) => {
        const id = `${name}-${opt.value}`;
        return (
          <Radio
            key={opt.value}
            id={id}
            name={name}
            value={opt.value}
            label={opt.label}
            description={opt.description}
            checked={value !== undefined ? value === opt.value : undefined}
            defaultChecked={value === undefined ? undefined : undefined}
            onChange={onChange}
          />
        );
      })}
    </fieldset>
  );
}
