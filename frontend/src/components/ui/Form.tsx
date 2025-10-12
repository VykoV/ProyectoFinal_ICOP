import { forwardRef } from "react";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  LabelHTMLAttributes,
} from "react";

export const Label = ({ children, htmlFor }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label htmlFor={htmlFor} className="block text-sm mb-1">{children}</label>
);

type InputProps = InputHTMLAttributes<HTMLInputElement>;
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  return (
    <input
      ref={ref}
      {...props}
      className={`w-full rounded-lg border px-3 py-2 text-sm ${props.className ?? ""}`}
    />
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(props, ref) {
  return (
    <select
      ref={ref}
      {...props}
      className={`w-full rounded-lg border px-3 py-2 text-sm ${props.className ?? ""}`}
    />
  );
});

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}
