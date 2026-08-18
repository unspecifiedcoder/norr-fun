import { useEffect, useRef, useState } from "react";
import { FaBell, FaBellSlash, FaCheck } from "react-icons/fa";
import { Panel } from "./ui/Panel";
import { StyledInput } from "./StyledIntput";
import { ActionButton } from "./ActionButton";
import { useToast } from "./toast-context";
import { price as fmtPrice } from "./ui/format";

/**
 * Watch a price without watching the screen.
 *
 * The threshold is kept in this browser — it is a personal reminder, not a
 * fact about the protocol that anyone else needs to verify, and putting it on
 * chain would cost gas for something only its owner cares about.
 *
 * What it is compared against is not local: the price comes from the curve's
 * own state, read live. So the alert is a real evaluation of real on-chain
 * data, and it fires exactly once per crossing rather than every poll — an
 * alert that repeats while a price sits above its threshold is an alert
 * people turn off.
 */
const key = (sale: string) => `norr.alert.${sale.toLowerCase()}`;

type Alert = { above?: number; below?: number; firedAbove?: boolean; firedBelow?: boolean };

export const PriceAlert = ({
  sale,
  name,
  price,
  symbol,
}: {
  sale: string;
  name: string;
  /** Current price, from the curve. */
  price: number;
  symbol: string;
}) => {
  const toast = useToast();
  const [alert, setAlert] = useState<Alert>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(key(sale)) ?? "{}") as Alert;
    } catch {
      return {};
    }
  });
  const [above, setAbove] = useState(alert.above?.toString() ?? "");
  const [below, setBelow] = useState(alert.below?.toString() ?? "");
  const lastPrice = useRef(price);

  const persist = (next: Alert) => {
    setAlert(next);
    try {
      if (next.above === undefined && next.below === undefined) {
        window.localStorage.removeItem(key(sale));
      } else {
        window.localStorage.setItem(key(sale), JSON.stringify(next));
      }
    } catch {
      /* an alert that does not survive the session is still useful in it */
    }
  };

  useEffect(() => {
    if (price <= 0) return;
    const previous = lastPrice.current;
    lastPrice.current = price;

    // Only a crossing counts, so an alert set below a standing price does not
    // fire immediately and then keep firing.
    if (alert.above !== undefined && previous < alert.above && price >= alert.above) {
      toast.push({
        kind: "info",
        title: `${name} crossed ${fmtPrice(alert.above)}`,
        detail: `Now ${fmtPrice(price)} ${symbol}.`,
      });
      persist({ ...alert, firedAbove: true });
    }
    if (alert.below !== undefined && previous > alert.below && price <= alert.below) {
      toast.push({
        kind: "info",
        title: `${name} fell below ${fmtPrice(alert.below)}`,
        detail: `Now ${fmtPrice(price)} ${symbol}.`,
      });
      persist({ ...alert, firedBelow: true });
    }
  }, [price, alert, name, symbol, toast]);

  const armed = alert.above !== undefined || alert.below !== undefined;

  return (
    <Panel
      title="Price alert"
      aside={
        armed ? (
          <span className="mark mark--live">
            <FaBell className="text-[9px]" /> armed
          </span>
        ) : undefined
      }
    >
      <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mb-3">
        Kept in this browser and compared against the curve's live price. Fires
        once when it crosses, not on every read.
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="label block mb-1.5">Rises above</span>
          <StyledInput
            value={above}
            onChange={(e) => setAbove(e.target.value)}
            placeholder={fmtPrice(price * 1.5)}
            type="number"
          />
        </label>
        <label className="block">
          <span className="label block mb-1.5">Falls below</span>
          <StyledInput
            value={below}
            onChange={(e) => setBelow(e.target.value)}
            placeholder={fmtPrice(price * 0.5)}
            type="number"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <ActionButton
          onClick={() =>
            persist({
              above: above.trim() ? Number(above) : undefined,
              below: below.trim() ? Number(below) : undefined,
            })
          }
          disabled={!above.trim() && !below.trim()}
          tone="quiet"
        >
          <FaCheck /> Set alert
        </ActionButton>

        {armed && (
          <button
            onClick={() => {
              persist({});
              setAbove("");
              setBelow("");
            }}
            className="text-[length:var(--t-fine)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors flex items-center gap-1.5"
          >
            <FaBellSlash className="text-[9px]" /> Clear
          </button>
        )}

        <span className="text-[length:var(--t-fine)] text-[var(--ink-4)] tabular ml-auto">
          now {fmtPrice(price)} {symbol}
        </span>
      </div>
    </Panel>
  );
};
