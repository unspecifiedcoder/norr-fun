import React from 'react'; type StyledInputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * A value field.
 *
 * Square, ruled, sunk against the sheet -- the security-printing convention
 * where a figure sits in a bounded tinted block rather than an outlined pill.
 * Numeric inputs pick up tabular figures from the global rule so digits do not
 * shift width as they are typed.
 */
export const StyledInput = (props: StyledInputProps) => (
  <input
    {...props} className={
      'w-full bg-[var(--snow-sunk)] border border-[var(--rule)] rounded-[var(--r-control)] px-2.5 py-2 ' +
      'text-[var(--ink)] placeholder:text-[var(--ink-4)] ' +
      'focus:border-[var(--ink)] outline-none transition-colors ' +
      (props.className ?? '')
    }
  />
);
