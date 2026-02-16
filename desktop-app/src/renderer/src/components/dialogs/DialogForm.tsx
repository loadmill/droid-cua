import type { ReactNode } from 'react';

interface DialogFormProps {
  onSubmit: () => Promise<void>;
  className?: string;
  children: ReactNode;
}

export function DialogForm({ onSubmit, className, children }: DialogFormProps) {
  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      {children}
    </form>
  );
}
