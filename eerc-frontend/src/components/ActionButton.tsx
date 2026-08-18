import React from 'react'; interface ActionButtonProps { onClick: () => void; children: React.ReactNode; disabled?: boolean;
  /** `quiet` for secondary actions that sit next to a primary one. */ tone?: 'primary' | 'quiet'; type?: 'button' | 'submit';
}

/**
 * The commit control.
 *
 * Reversed ink for the primary action -- the timetable's device for top rank
 * without a size jump. Square, because every other edge on the sheet is square.
 * No shadow and no hover-scale: this button usually signs a transaction, and
 * bouncing it under the cursor undercuts that.
 */
export const ActionButton = ({ onClick, children, disabled = false, tone = 'primary', type = 'button',
}: ActionButtonProps) => { const base =
    'px-4 py-2 font-bold text-[length:var(--t-fine)] uppercase tracking-[0.09em] ' +
    'inline-flex items-center justify-center gap-2 border transition-colors ' +
    'disabled:cursor-not-allowed'; const tones = { primary:
      'bg-[var(--ink)] text-[var(--sheet-raised)] border-[var(--ink)] ' +
      'hover:bg-[var(--falu)] hover:border-[var(--falu)] ' +
      'disabled:bg-[var(--ink-4)] disabled:border-[var(--ink-4)]', quiet:
      'bg-transparent text-[var(--ink)] border-[var(--rule)] ' +
      'hover:border-[var(--ink)] ' +
      'disabled:text-[var(--ink-4)] disabled:border-[var(--rule)] disabled:hover:border-[var(--rule)]',
  } as const; return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${tones[tone]}`}>
      {children}
    </button>
  );
};
