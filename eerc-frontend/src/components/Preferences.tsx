import { FaUndo } from "react-icons/fa";
import { Panel } from "./ui/Panel";
import { Segmented } from "./ui/Controls";
import { ActionButton } from "./ActionButton";
import { StyledInput } from "./StyledIntput";
import { usePreferences } from "../hooks/usePreferences";

/**
 * Display settings.
 *
 * Held in local storage, not on chain: none of it is something another party
 * needs to verify, and none of it should cost gas. The choices that *are*
 * consequential — follows, watchlist — live on chain instead, and the page
 * says so rather than leaving the reader to guess which is which.
 */
export const Preferences = () => {
  const { prefs, set, reset } = usePreferences();

  return (
    <div className="max-w-3xl">
      <header className="mb-5">
        <h1 className="lead">Settings</h1>
        <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-1.5">
          Kept on this device. Nothing here touches the chain, so nothing here
          costs anything.
        </p>
      </header>

      <Panel title="Trading">
        <Row
          label="Default slippage"
          hint="Prefilled into the trade panel. Higher tolerates more price movement between quote and fill."
        >
          <div className="w-24">
            <StyledInput
              value={prefs.slippagePct}
              onChange={(e) => set("slippagePct", e.target.value)}
              placeholder="1"
              type="number"
            />
          </div>
        </Row>
      </Panel>

      <Panel title="Display" className="mt-3">
        <Row
          label="Activity opens on"
          hint="Whether the activity feed starts scoped to you or the whole protocol."
        >
          <Segmented
            options={[
              { value: "mine" as const, label: "You" },
              { value: "all" as const, label: "Everyone" },
            ]}
            value={prefs.activityScope}
            onChange={(v) => set("activityScope", v)}
            label="Default activity scope"
          />
        </Row>

        <div className="border-t border-[var(--rule)] my-4" />

        <Row
          label="Density"
          hint="Compact takes a step out of every panel's padding. The type scale does not change."
        >
          <Segmented
            options={[
              { value: "comfortable" as const, label: "Roomy" },
              { value: "compact" as const, label: "Compact" },
            ]}
            value={prefs.density}
            onChange={(v) => set("density", v)}
            label="Sheet density"
          />
        </Row>

        <div className="border-t border-[var(--rule)] my-4" />

        <Row
          label="High contrast"
          hint="Raises every hairline and muted label. Worth turning on for a projector."
        >
          <Toggle
            on={prefs.highContrast}
            onChange={(v) => set("highContrast", v)}
            label="High contrast"
          />
        </Row>

        <div className="border-t border-[var(--rule)] my-4" />

        <Row
          label="Large numbers"
          hint="Abbreviated scans faster in a feed; full is what reconciling a payout needs."
        >
          <Segmented
            options={[
              { value: "compact" as const, label: "1.0K" },
              { value: "full" as const, label: "1,000" },
            ]}
            value={prefs.compactNumbers ? "compact" : "full"}
            onChange={(v) => set("compactNumbers", v === "compact")}
            label="Number format"
          />
        </Row>

        <div className="border-t border-[var(--rule)] my-4" />

        <Row
          label="Dates"
          hint="8/9/2026 means two different days depending on where the reader is. ISO does not."
        >
          <Segmented
            options={[
              { value: "local" as const, label: "Local" },
              { value: "iso" as const, label: "ISO" },
            ]}
            value={prefs.dateFormat}
            onChange={(v) => set("dateFormat", v)}
            label="Date format"
          />
        </Row>

        <div className="border-t border-[var(--rule)] my-4" />

        <Row label="Shorten addresses" hint="Show 0x1234…abcd instead of the full address.">
          <Toggle
            on={prefs.abbreviateAddresses}
            onChange={(v) => set("abbreviateAddresses", v)}
            label="Shorten addresses"
          />
        </Row>
      </Panel>

      <div className="mt-4">
        <ActionButton onClick={reset} tone="quiet">
          <FaUndo /> Back to defaults
        </ActionButton>
      </div>
    </div>
  );
};

const Row = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-start justify-between gap-6 flex-wrap">
    <div className="min-w-0 max-w-md">
      <p className="text-[length:var(--t-base)] text-[var(--ink)]">{label}</p>
      <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-0.5">{hint}</p>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

/**
 * Square, like everything else here. A pill switch would be the one rounded
 * control on the surface, which is exactly how a stray component announces
 * that it came from somewhere else.
 */
const Toggle = ({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) => (
  <button
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={() => onChange(!on)}
    className="w-11 h-6 border rounded-[var(--r-control)] transition-colors relative"
    style={{
      background: on ? "var(--falu-wash)" : "var(--snow-sunk)",
      borderColor: on ? "var(--falu)" : "var(--rule)",
    }}
  >
    <span
      className="absolute top-[3px] w-4 h-4 transition-all rounded-[1px]"
      style={{
        background: on ? "var(--falu)" : "var(--ink-4)",
        left: on ? "1.5rem" : "3px",
      }}
    />
  </button>
);
