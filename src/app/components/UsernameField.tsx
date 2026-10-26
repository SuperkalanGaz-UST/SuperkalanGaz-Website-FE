'use client';

import { useId } from 'react';

export function usernameValidationError(value: string): string | undefined {
  if (!value.trim()) return 'Username is required';
  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(value.trim())) {
    return 'Use 3–64 letters, numbers, dots, underscores, or hyphens';
  }
}

/** Consistent self-service username control for every staff persona. */
export function UsernameField({ value, onChange, error, className }: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className: string;
}) {
  const id = useId();
  return (
    <div className="text-sm font-medium text-gray-700 md:col-span-2">
      <label htmlFor={id}>Username</label>
      <input
        id={id}
        name="username"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={className}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={64}
        aria-invalid={!!error}
        aria-describedby={`${id}-help`}
      />
      <p id={`${id}-help`} className={`mt-1.5 text-xs font-normal ${error ? 'text-red-600' : 'text-gray-500'}`}>
        {error || 'Used to sign in to your account.'}
      </p>
    </div>
  );
}
