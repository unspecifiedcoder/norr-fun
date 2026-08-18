import { FaUndo } from "react-icons/fa";
import { Card } from "./Card";
import { ActionButton } from "./ActionButton";
import { StyledInput } from "./StyledIntput";
import { usePreferences } from "../hooks/usePreferences";

/**
 * Display settings. Held in local storage, not on chain — none of it is
 * something another party needs to verify, and none of it should cost gas.
 */
export const Preferences = () => { const { prefs, set, reset } = usePreferences(); return (
    <Card title="Settings">
      <p className="text-[var(--ink-2)] text-[length:var(--t-base)] mb-6">
        Kept on this device. Nothing here touches the chain, so nothing here costs anything — the choices that do are your follows and watchlist.
      </p>

      <div className="space-y-5">
        <Row label="Default slippage" hint="Prefilled into the trade panel. Higher tolerates more price movement between quote and fill."
        >
          <div className="w-28">
            <StyledInput value={prefs.slippagePct} onChange={(e) => set("slippagePct", e.target.value)} placeholder="1" type="number"
            />
          </div>
        </Row>

        <Row label="Activity opens on" hint="Whether the activity feed starts scoped to you or the whole protocol."
        >
          <div className="flex gap-1">
            {(["mine", "all"] as const).map((s) => (
              <button key={s} onClick={() => set("activityScope", s)} className={`px-3 py-1.5 text-[length:var(--t-fine)] border transition-colors ${ prefs.activityScope === s
                    ? "border-[var(--rule)] bg-[var(--snow-sunk)] text-[var(--ink)]"
                    : "border-[var(--rule)] text-[var(--ink-3)] hover:text-[var(--ink)]"
                }`}
              >
                {s === "mine" ? "You" : "Everyone"}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Shorten addresses" hint="Show 0x1234…abcd instead of the full address.">
          <Toggle on={prefs.abbreviateAddresses} onChange={(v) => set("abbreviateAddresses", v)} label="Shorten addresses"
          />
        </Row>
      </div>

      <div className="mt-6 pt-5 border-t border-[var(--rule)]">
        <ActionButton onClick={reset}>
          <FaUndo /> Back to defaults
        </ActionButton>
      </div>
    </Card>
  );
}; const Row = ({ label, hint, children,
}: { label: string; hint: string; children: React.ReactNode;
}) => (
  <div className="flex items-start justify-between gap-6 flex-wrap">
    <div className="min-w-0 max-w-md">
      <p className="text-[length:var(--t-base)] text-[var(--ink)]">{label}</p>
      <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-0.5">{hint}</p>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
); const Toggle = ({ on, onChange, label,
}: { on: boolean; onChange: (v: boolean) => void; label: string;
}) => (
  <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`w-11 h-6 rounded-full border transition-colors relative ${ on ? "bg-[var(--fjord-wash)] border-[var(--fjord)]" : "bg-[var(--snow-sunk)] border-[var(--rule)]"
    }`}
  >
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${ on ? "left-[1.55rem]" : "left-0.5"
      }`}
    />
  </button>
);
