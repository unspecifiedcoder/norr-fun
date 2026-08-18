import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import {
  FaPlus, FaTrash, FaRocket, FaCheck, FaTimes, FaArrowLeft, FaUpload,
  FaLock, FaExclamationTriangle, FaBullhorn, FaExternalLinkAlt,
} from "react-icons/fa";
import { Panel } from "./ui/Panel";
import { Collapse } from "./ui/Collapse";
import { Meter } from "./ui/Controls";
import { Avatar } from "./ui/Avatar";
import { ActionButton } from "./ActionButton";
import { StyledInput } from "./StyledIntput";
import { useCreateLaunch, CATEGORIES, type Category, type DeployStep } from "../hooks/useCreateLaunch";
import { useBoards } from "../hooks/useBoards";
import { useRegistryFeed } from "../hooks/useRegistryFeed";
import { usePromotion, type Tier } from "../hooks/usePromotion";
import { short, compact } from "./ui/format";

const CATEGORY_COLORS: Record<string, string> = {
  Creator: "var(--cat-creator)",
  Partner: "var(--cat-partner)",
  Rewards: "var(--cat-rewards)",
  Marketing: "var(--cat-marketing)",
  Buyback: "var(--cat-buyback)",
  Liquidity: "var(--cat-liquidity)",
  Treasury: "var(--cat-treasury)",
  Custom: "var(--cat-custom)",
};

/**
 * Logo bytes that may be written on chain.
 *
 * A logo URI is registry *state*, so an inlined image is paid for at deploy
 * time by whoever ships the launch. Twelve kilobytes is roughly where that
 * stops being a rounding error, and the form says so instead of letting a
 * dropped screenshot quietly triple the gas.
 */
const MAX_INLINE_LOGO = 12_000;

/**
 * The launch builder.
 *
 * Two modes over one form. `instant` shows the three fields a launch cannot
 * do without and routes everything raised to the creator; `full` opens the
 * split editor. Both deploy identical contracts — the mode changes what is on
 * screen, never what is signed.
 *
 * The right rail is the point of the layout: what the launch will look like,
 * what is still missing, and what is already set, all visible while the form
 * is being filled rather than on a review step after it.
 */
export const CreateLaunch = ({
  onDone,
  mode = "full",
}: {
  onDone: () => void;
  mode?: "instant" | "full";
}) => {
  const c = useCreateLaunch();
  const { boards } = useBoards();
  const { rows: feedRows } = useRegistryFeed("newest", 100);
  const { address } = useAccount();
  const promo = usePromotion(c.deployed?.ido);
  const [plan, setPlan] = useState<Tier | null>(null);

  const instant = mode === "instant";
  const first = c.draft.splits[0];

  /**
   * Instant mode has no split editor, so the split it will deploy is filled
   * in here — visibly, in the applied-settings list — rather than assembled
   * silently at submit time.
   */
  useEffect(() => {
    if (!instant || !address || !first) return;
    if (first.recipient === address && first.percent === "100") return;
    c.setSplit(first.id, {
      recipient: address,
      percent: "100",
      label: "Creator",
      category: "Creator",
    });
    // Only re-runs when the wallet changes; c.setSplit is stable.
  }, [instant, address, first?.id]);

  const chosenDesk = boards.find((b) => b.id === c.draft.boardId);
  const allocated = c.totalBps / 100;
  const allocationOk = c.totalBps === 10_000;

  /**
   * Ticker collision.
   *
   * Symbols are not unique on chain and nothing stops two raises sharing one,
   * but a duplicate makes both harder to find and the feed harder to read.
   * Stated as a caution rather than a block: it is the creator's call, and
   * the registry will accept it either way.
   */
  const clash = feedRows.find(
    (r) =>
      c.draft.symbol.trim().length > 0 &&
      r.launch.symbol.toLowerCase() === c.draft.symbol.trim().toLowerCase(),
  );

  const core = [
    { key: "name", ok: c.draft.name.trim().length > 0 },
    { key: "symbol", ok: c.draft.symbol.trim().length > 0 },
    { key: "supply", ok: Number(c.draft.supply) > 0 },
  ];
  const coreDone = core.filter((f) => f.ok).length;
  const missing = core.filter((f) => !f.ok).map((f) => f.key);

  return (
    <div className="max-w-[1400px]">
      <div className="flex items-center justify-between gap-4 mb-4">
        <Link
          to="/start"
          className="inline-flex items-center gap-2 text-[length:var(--t-fine)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
        >
          <FaArrowLeft /> Launch models
        </Link>
        <Link
          to={instant ? "/start/raise" : "/start/instant"}
          className="text-[length:var(--t-fine)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
        >
          {instant ? "Need a custom split? →" : "← Just ship it instead"}
        </Link>
      </div>

      <ChainPicker />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_21rem] gap-4 mt-4 items-start">
        {/* ============================== form ============================== */}
        <div className="min-w-0 space-y-3">
          <Panel
            title={instant ? "Launch instantly with a name, ticker and supply" : "Identity"}
            aside={
              <span className="text-[length:var(--t-fine)] text-[var(--ink-3)] border border-[var(--rule)] px-2 py-0.5 rounded-[var(--r-control)] tabular">
                {coreDone}/3 required
              </span>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_11rem] gap-4">
              <div className="space-y-3">
                <Field label="Project name" required>
                  <StyledInput
                    value={c.draft.name}
                    onChange={(e) => c.update("name", e.target.value)}
                    placeholder="Northern Lights"
                  />
                </Field>
                <Field label="Ticker" required>
                  <StyledInput
                    value={c.draft.symbol}
                    onChange={(e) => c.update("symbol", e.target.value.toUpperCase())}
                    placeholder="NRTH"
                  />
                  {clash && (
                    <span className="block text-[length:var(--t-fine)] text-[var(--ochre)] mt-1.5">
                      {clash.launch.name} already uses {clash.launch.symbol} on this
                      chain. Allowed, but both get harder to find.
                    </span>
                  )}
                </Field>
                <Field
                  label="Total supply"
                  required
                  hint="Minted once, at deploy. There is no mint function afterwards."
                >
                  <StyledInput
                    value={c.draft.supply}
                    onChange={(e) => c.update("supply", e.target.value)}
                    placeholder="1000000"
                    type="number"
                  />
                  {/* The three supplies almost every launch picks, so the
                      common case is one click and the field stays free for
                      anything else. */}
                  <span className="flex gap-1 mt-1.5">
                    {[
                      ["1M", "1000000"],
                      ["10M", "10000000"],
                      ["1B", "1000000000"],
                    ].map(([label, value]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => c.update("supply", value)}
                        className="text-[length:var(--t-fine)] px-1.5 py-0.5 border rounded-[var(--r-control)] transition-colors"
                        style={
                          c.draft.supply === value
                            ? { borderColor: "var(--falu)", color: "var(--falu)" }
                            : { borderColor: "var(--rule)", color: "var(--ink-3)" }
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </span>
                </Field>
              </div>

              <LogoDrop
                value={c.draft.logoURI}
                onChange={(v) => c.update("logoURI", v)}
                fallback={c.draft.symbol}
              />
            </div>
          </Panel>

          <p className="label pt-2">Optional settings</p>

          <Collapse
            title="Summary"
            hint="One line, shown on every card in the feed."
            summary={c.draft.description ? "set" : "none"}
            defaultOpen={!instant}
          >
            <Field label="What is this raise for?">
              <StyledInput
                value={c.draft.description}
                onChange={(e) => c.update("description", e.target.value)}
                placeholder="Infrastructure for private contribution rounds"
              />
            </Field>
          </Collapse>

          <Collapse
            title="Publishing desk"
            hint="Route a share to a desk and appear in its index."
            summary={chosenDesk ? `/${chosenDesk.slug}` : "on my own"}
          >
            <Field label="Publish through">
              <select
                value={String(c.draft.boardId)}
                onChange={(e) => c.update("boardId", BigInt(e.target.value))}
                className="bg-[var(--snow-sunk)] border border-[var(--rule)] rounded-[var(--r-control)] px-3 py-2 text-[var(--ink)] text-[length:var(--t-base)] outline-none w-full"
              >
                <option value="0">On my own — no desk</option>
                {boards.map((b) => (
                  <option key={b.slug} value={String(b.id)}>
                    {b.name} (/{b.slug}) — {b.minPartnerBps / 100}% minimum
                  </option>
                ))}
              </select>
            </Field>
            {chosenDesk && chosenDesk.minPartnerBps > 0 && (
              <p className="text-[length:var(--t-fine)] text-[var(--ochre)] mt-2 flex items-start gap-2">
                <FaExclamationTriangle className="mt-0.5 shrink-0" />
                This desk requires at least {chosenDesk.minPartnerBps / 100}% routed to{" "}
                {short(chosenDesk.owner)}. The registry checks your split against
                that and rejects the raise otherwise.
              </p>
            )}
          </Collapse>

          <Collapse
            title="Payout split"
            hint="Who earns from this raise, enforced by the contract."
            badge={<span className="mark mark--live">signature</span>}
            summary={`${c.draft.splits.length} · ${allocated}%`}
            defaultOpen={!instant}
            accent
          >
            <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mb-3">
              Split the raise between the people who earn from it. Recipients
              withdraw their own share, and the total has to land on exactly
              100% before this can ship.
            </p>

            <div className="flex h-2 rounded-[var(--r-control)] overflow-hidden mb-3 bg-[var(--snow-sunk)] border border-[var(--rule)]">
              {c.draft.splits.map((s) => {
                const p = Number.parseFloat(s.percent);
                return Number.isFinite(p) && p > 0 ? (
                  <div
                    key={s.id}
                    style={{
                      width: `${Math.min(p, 100)}%`,
                      background: CATEGORY_COLORS[s.category],
                    }}
                    title={`${s.label || s.category} — ${p}%`}
                  />
                ) : null;
              })}
            </div>

            <div className="space-y-2">
              {c.draft.splits.map((s) => (
                <div
                  key={s.id}
                  className="panel panel--sunk p-2.5 grid grid-cols-1 lg:grid-cols-[8rem_minmax(0,1fr)_5rem_2.25rem] gap-2 items-end"
                >
                  <Field label="Bucket" dense>
                    <select
                      value={s.category}
                      onChange={(e) => c.setSplit(s.id, { category: e.target.value as Category })}
                      className="bg-[var(--snow-sunk)] border border-[var(--rule)] rounded-[var(--r-control)] px-2 py-2 text-[var(--ink)] text-[length:var(--t-fine)] outline-none w-full"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Wallet and what it's for" dense>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <StyledInput
                        value={s.recipient}
                        onChange={(e) => c.setSplit(s.id, { recipient: e.target.value })}
                        placeholder="0x…"
                      />
                      <StyledInput
                        value={s.label}
                        onChange={(e) => c.setSplit(s.id, { label: e.target.value })}
                        placeholder="Founding team"
                      />
                    </div>
                  </Field>
                  <Field label="Share %" dense>
                    <StyledInput
                      value={s.percent}
                      onChange={(e) => c.setSplit(s.id, { percent: e.target.value })}
                      placeholder="60"
                      type="number"
                    />
                  </Field>
                  <button
                    onClick={() => c.removeSplit(s.id)}
                    disabled={c.draft.splits.length === 1}
                    aria-label="Remove allocation"
                    className="h-9 grid place-items-center border border-[var(--rule)] rounded-[var(--r-control)] text-[var(--ink-3)] hover:text-[var(--falu)] hover:border-[var(--falu)] disabled:opacity-30 disabled:hover:text-[var(--ink-3)] disabled:hover:border-[var(--rule)] transition-colors"
                  >
                    <FaTrash className="text-[10px]" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-4 mt-3 flex-wrap">
              <button
                onClick={c.addSplit}
                className="text-[length:var(--t-fine)] text-[var(--ink-2)] flex items-center gap-2 px-3 py-1.5 border border-[var(--rule)] rounded-[var(--r-control)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)] transition-colors"
              >
                <FaPlus className="text-[10px]" /> Add a recipient
              </button>
              <p
                className="text-[length:var(--t-base)] font-bold tabular"
                style={{ color: allocationOk ? "var(--gain)" : "var(--ochre)" }}
              >
                {allocated}% allocated
                {!allocationOk && (
                  <span className="font-normal text-[var(--ink-3)]">
                    {" "}
                    — {(100 - allocated).toFixed(2)}% left
                  </span>
                )}
              </p>
            </div>
          </Collapse>

          <Collapse
            title="What stays private"
            hint="How this raise treats contribution amounts."
            summary="sealed"
          >
            <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] flex items-start gap-2">
              <FaLock className="mt-0.5 shrink-0 text-[var(--falu)]" />
              Contributions are held as encrypted balances, so no wallet's
              position in this raise is readable from the chain. The split
              above, the tally, every claim and every later trade are public —
              that is what makes the payout auditable.
            </p>
          </Collapse>

          {/* Placement is bought against a sale address, which does not exist
              until this deploys. Choosing here just carries the intent to the
              step after. */}
          {promo.available && promo.tiers.length > 0 && (
            <div>
              <p className="label pt-3 pb-2">Feed placement</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {promo.tiers.map((t) => {
                  const on = plan?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setPlan(on ? null : t)}
                      className="card-link p-3 text-left"
                      style={on ? { borderColor: "var(--falu)" } : undefined}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-[length:var(--t-base)] font-bold text-[var(--ink)]">
                          {t.name}
                        </span>
                        {on && <FaCheck className="text-[10px] text-[var(--falu)]" />}
                      </span>
                      <span className="block text-[length:var(--t-fine)] text-[var(--ink-3)] mt-0.5">
                        {t.duration > 0n
                          ? `Runs ${Number(t.duration) / 86400} days`
                          : "No placement — the default"}
                      </span>
                      <span className="block text-[length:var(--t-base)] text-[var(--ink)] tabular mt-2 pt-2 border-t border-[var(--rule)]">
                        {t.price === 0n ? "Free" : `${promo.formatPrice(t.price)} ETH`}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-2">
                Bought after the raise exists, in one more signature. Placement
                changes where a raise appears and nothing about its economics.
              </p>
            </div>
          )}
        </div>

        {/* ============================ side rail ============================ */}
        <div className="space-y-3 xl:sticky xl:top-[4.25rem]">
          <Panel title="Live preview">
            <div className="panel panel--sunk p-3">
              <div className="flex items-start gap-2.5">
                <Avatar
                  src={c.draft.logoURI || undefined}
                  seed={address ?? "preview"}
                  fallback={c.draft.symbol || "$$"}
                  size={34}
                  badge="A"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[var(--ink)] truncate text-[length:var(--t-fine)]">
                    {c.draft.name || "Untitled raise"}{" "}
                    <span className="text-[var(--ink-3)] font-normal">
                      {c.draft.symbol || "TICKER"}
                    </span>
                  </p>
                  <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-0.5 flex items-center gap-1.5">
                    <FaLock className="text-[9px]" />
                    <span className="uppercase tracking-[0.1em]">sealed</span>
                    <span className="text-[var(--ink-4)]">by</span>
                    {short(address ?? "0x0000000000000000000000000000000000000000")}
                  </p>
                </div>
              </div>
              <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mt-2 clamp-2 min-h-[2.4em]">
                {c.draft.description || "No summary yet."}
              </p>
              <div className="flex h-1.5 rounded-[var(--r-control)] overflow-hidden mt-2 bg-[var(--snow)] border border-[var(--rule)]">
                {c.draft.splits.map((s) => {
                  const p = Number.parseFloat(s.percent);
                  return Number.isFinite(p) && p > 0 ? (
                    <div
                      key={s.id}
                      style={{
                        width: `${Math.min(p, 100)}%`,
                        background: CATEGORY_COLORS[s.category],
                      }}
                    />
                  ) : null;
                })}
              </div>
              <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-2 tabular">
                supply {Number(c.draft.supply) > 0 ? compact(Number(c.draft.supply)) : "—"} ·{" "}
                {c.draft.splits.length}{" "}
                {c.draft.splits.length === 1 ? "recipient" : "recipients"}
              </p>
            </div>
          </Panel>

          <Panel
            title="Launch status"
            aside={
              <span className="text-[length:var(--t-fine)] text-[var(--ink-3)] tabular">
                {coreDone}/3 core fields
              </span>
            }
          >
            <Meter value={coreDone} max={3} ticked={false} />

            <div className="mt-3">
              <ActionButton onClick={c.deploy} disabled={!c.ready || c.busy}>
                <FaRocket />
                {c.busy
                  ? "Deploying…"
                  : c.ready
                    ? "Deploy launch"
                    : missing.length
                      ? "Complete required fields"
                      : "Resolve the checks below"}
              </ActionButton>
            </div>

            {c.problems.length > 0 && (
              <ul className="text-[length:var(--t-fine)] text-[var(--ink-3)] space-y-1 mt-3">
                {c.problems.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <span className="text-[var(--ochre)] mt-0.5">•</span>
                    <span>Still needs {p}.</span>
                  </li>
                ))}
              </ul>
            )}

            {!c.isConnected && (
              <p className="text-[length:var(--t-fine)] text-[var(--ochre)] mt-3">
                Connect a wallet to sign the deployment.
              </p>
            )}

            <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-3">
              Four signatures: token, fee router, sale contract, then publishing
              it to the feed.
            </p>
          </Panel>

          <Panel title="Applied settings">
            <dl className="space-y-1.5">
              <Applied k="Recipients" v={String(c.draft.splits.length)} ok />
              <Applied
                k="Allocated"
                v={`${allocated}%`}
                ok={allocationOk}
              />
              <Applied k="Desk" v={chosenDesk ? `/${chosenDesk.slug}` : "none"} ok />
              <Applied k="Contributions" v="sealed" ok />
              <Applied k="Placement" v={plan ? plan.name : "none"} ok />
            </dl>
            {missing.length > 0 && (
              <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-3 pt-3 border-t border-[var(--rule)]">
                Missing: <span className="text-[var(--ochre)]">{missing.join(", ")}</span>
              </p>
            )}
          </Panel>

          {c.steps.length > 0 && (
            <Panel title="Deployment">
              <ol className="space-y-2">
                {c.steps.map((s) => (
                  <StepRow key={s.key} step={s} />
                ))}
              </ol>

              {c.error && (
                <p className="text-[length:var(--t-fine)] text-[var(--falu)] mt-3 break-words">
                  {c.error}
                </p>
              )}

              {c.deployed && (
                <div className="mt-4 pt-3 border-t border-[var(--rule)] space-y-2.5">
                  <p className="text-[length:var(--t-fine)] text-[var(--gain)]">
                    Live. It's in the feed now.
                  </p>

                  {plan && plan.price > 0n && promo.available && (
                    <ActionButton onClick={() => promo.buy(plan)} disabled={promo.busy} tone="quiet">
                      <FaBullhorn />
                      {promo.busy ? "Buying…" : `Buy ${plan.name} placement`}
                    </ActionButton>
                  )}
                  {promo.status && (
                    <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] break-words">
                      {promo.status}
                    </p>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <ActionButton onClick={onDone}>Go to the feed</ActionButton>
                    <Link
                      to={`/raise/${c.deployed.ido}`}
                      className="px-4 py-2 border border-[var(--rule)] rounded-[var(--r-control)] text-[length:var(--t-fine)] uppercase tracking-[0.09em] text-[var(--ink)] hover:border-[var(--ink)] transition-colors inline-flex items-center gap-2"
                    >
                      <FaExternalLinkAlt className="text-[10px]" /> Open it
                    </Link>
                  </div>
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------- fragments */

/**
 * The chain this deploys to.
 *
 * Held at the top of the form and switched in place, because a launch
 * deployed to the wrong network is not recoverable — it is a different set of
 * contracts with a different registry, and nothing about the wizard would
 * have hinted at the mistake.
 */
const ChainPicker = () => {
  const chainId = useChainId();
  const { chains, switchChain, isPending } = useSwitchChain();

  return (
    <Panel
      title="Network"
      aside={
        <div className="seg" role="group" aria-label="Deployment network">
          {chains.map((ch) => (
            <button
              key={ch.id}
              type="button"
              className="seg__btn"
              data-on={ch.id === chainId}
              data-accent="true"
              aria-pressed={ch.id === chainId}
              disabled={isPending}
              onClick={() => switchChain({ chainId: ch.id })}
            >
              {ch.name}
            </button>
          ))}
        </div>
      }
    >
      <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">
        Contracts deploy to the connected network and are published to that
        network's registry. A raise cannot be moved afterwards.
      </p>
    </Panel>
  );
};

/**
 * The logo.
 *
 * Two paths, because there are two honest ones. A hosted URL costs nothing to
 * store; a dropped file is inlined as a data URI, which goes on chain and is
 * paid for at deploy — so the size is shown before it is accepted and large
 * files are refused rather than silently bloating the transaction.
 */
const LogoDrop = ({
  value,
  onChange,
  fallback,
}: {
  value: string;
  onChange: (v: string) => void;
  fallback: string;
}) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [note, setNote] = useState("");

  const take = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNote("That is not an image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const uri = String(reader.result);
      if (uri.length > MAX_INLINE_LOGO) {
        setNote(
          `${(uri.length / 1000).toFixed(0)}kB is too large to store on chain. Host it and paste the URL.`,
        );
        return;
      }
      setNote(`${(uri.length / 1000).toFixed(1)}kB, written to the registry at deploy.`);
      onChange(uri);
    };
    reader.readAsDataURL(file);
  };

  const bytes = useMemo(
    () => (value.startsWith("data:") ? `${(value.length / 1000).toFixed(1)}kB on chain` : ""),
    [value],
  );

  return (
    <div>
      <span className="label block mb-1.5">Logo</span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files?.[0]);
        }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
        className="border border-dashed rounded-[var(--r-panel)] h-[9.5rem] grid place-items-center cursor-pointer transition-colors text-center px-2"
        style={{
          borderColor: over ? "var(--falu)" : "var(--rule)",
          background: over ? "var(--falu-wash)" : "var(--snow-sunk)",
        }}
      >
        {value ? (
          <div className="flex flex-col items-center gap-1.5">
            <Avatar src={value} fallback={fallback} size={48} />
            <span className="text-[length:var(--t-fine)] text-[var(--ink-3)]">replace</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <FaUpload className="text-[var(--ink-3)]" />
            <span className="text-[length:var(--t-fine)] text-[var(--ink-3)]">
              Drop an image
            </span>
            <span className="text-[length:var(--t-fine)] text-[var(--ink-4)]">or click</span>
          </div>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => take(e.target.files?.[0])}
      />
      <StyledInput
        value={value.startsWith("data:") ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste a URL"
        className="mt-2 !text-[length:var(--t-fine)]"
      />
      {(note || bytes) && (
        <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-1.5">{note || bytes}</p>
      )}
    </div>
  );
};

const Field = ({
  label,
  children,
  dense = false,
  required = false,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  dense?: boolean;
  required?: boolean;
  hint?: string;
}) => (
  <label className="block">
    <span
      className={`block mb-1.5 ${
        dense ? "label" : "text-[length:var(--t-fine)] text-[var(--ink-2)]"
      }`}
    >
      {label}
      {required && <span className="text-[var(--falu)]"> *</span>}
    </span>
    {children}
    {hint && (
      <span className="block text-[length:var(--t-fine)] text-[var(--ink-4)] mt-1">{hint}</span>
    )}
  </label>
);

const Applied = ({ k, v, ok }: { k: string; v: string; ok: boolean }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className="text-[length:var(--t-fine)] text-[var(--ink-3)] flex items-center gap-2">
      {ok ? (
        <FaCheck className="text-[9px] text-[var(--gain)]" />
      ) : (
        <FaTimes className="text-[9px] text-[var(--ochre)]" />
      )}
      {k}
    </dt>
    <dd className="text-[length:var(--t-fine)] text-[var(--ink)] tabular">{v}</dd>
  </div>
);

const StepRow = ({ step }: { step: DeployStep }) => {
  const icon = {
    pending: <span className="text-[var(--ink-4)]">○</span>,
    active: <span className="text-[var(--falu)]">◐</span>,
    done: <FaCheck className="text-[var(--gain)] text-[10px]" />,
    failed: <FaTimes className="text-[var(--falu)] text-[10px]" />,
  }[step.status];

  return (
    <li className="flex items-start gap-2.5 text-[length:var(--t-fine)]">
      <span className="w-3.5 grid place-items-center mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0">
        <span style={{ color: step.status === "pending" ? "var(--ink-4)" : "var(--ink)" }}>
          {step.label}
        </span>
        {step.detail && (
          <span className="block text-[length:var(--t-fine)] text-[var(--ink-4)] break-all">
            {step.detail}
          </span>
        )}
      </span>
    </li>
  );
};
