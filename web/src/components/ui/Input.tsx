import { clsx } from 'clsx';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function Input({ label, className, ...rest }: InputProps): JSX.Element {
  return (
    <label className="field">
      {label ? <span className="field-label">{label}</span> : null}
      <input className={clsx('input', className)} {...rest} />
    </label>
  );
}
