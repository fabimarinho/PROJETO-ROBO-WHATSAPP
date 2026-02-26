import { clsx } from 'clsx';

export function Card(props: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const { className, ...rest } = props;
  return <div className={clsx('card', className)} {...rest} />;
}
