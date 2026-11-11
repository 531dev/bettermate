import { Button } from '../Button.jsx';

export function PrimaryButton({ children, ...rest }) {
  return (
    <Button variant='primary' {...rest}>
      {children}
    </Button>
  );
}

export function SecondaryButton({ children, ...rest }) {
  return <Button {...rest}>{children}</Button>;
}
