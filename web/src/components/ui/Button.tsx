import { clsx } from 'clsx';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

export function Button({ variant = 'primary', className, ...rest }: ButtonProps): JSX.Element {
  return <button className={clsx('btn', `btn-${variant}`, className)} {...rest} />;
}
