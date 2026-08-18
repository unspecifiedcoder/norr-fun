import React from 'react'; interface CardProps { title: string; children: React.ReactNode;
  /** Right-aligned slot in the title rule -- counts, states, a single action. */ aside?: React.ReactNode;
}

/**
 * A ruled section of the sheet.
 *
 * Not a floating card: no radius, no shadow, no nesting. The heading sits on a
 * rule that runs the full width, which is what separates one section from the
 * next. Stacked sections share a single rule rather than each drawing its own
 * box, so a long page reads as one continuous document.
 */
export const Card = ({ title, children, aside }: CardProps) => (
  <section className="bg-[var(--sheet)] border border-[var(--rule)] mb-4">
    <header className="flex items-baseline justify-between gap-4 px-4 py-2.5 border-b border-[var(--rule)]">
      <h2 className="label !text-[var(--ink)]">{title}</h2>
      {aside}
    </header>
    <div className="p-4">{children}</div>
  </section>
);
