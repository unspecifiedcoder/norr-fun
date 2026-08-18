import { useState } from "react";
import { FaImage, FaCheck } from "react-icons/fa";
import { price as fmtPrice, compact, short } from "./ui/format";

/**
 * A share card, drawn on the client.
 *
 * Rendered into a canvas here rather than fetched from an image service:
 * there is no server in this project, and inventing one just to make a PNG
 * would contradict the thing it says on every other screen. Every figure on
 * the card is passed in from the same contract reads the page is already
 * showing, so a shared card cannot claim a number the launch page does not.
 */
export const ShareCard = ({
  name,
  symbol,
  base,
  priceNow,
  changePct,
  changeWindow,
  marketCap,
  fills,
  creator,
  sealed,
}: {
  name: string;
  symbol: string;
  base: string;
  priceNow: number;
  changePct: number;
  changeWindow: string;
  marketCap: number;
  fills: number;
  creator: string;
  sealed: boolean;
}) => {
  const [done, setDone] = useState(false);

  const draw = () => {
    const W = 1200;
    const H = 630;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext("2d");
    if (!g) return;

    const mono = '600 28px ui-monospace, SFMono-Regular, Menlo, monospace';

    // Ground and frame, in the app's own palette.
    g.fillStyle = "#08090a";
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "#22262b";
    g.lineWidth = 2;
    g.strokeRect(40, 40, W - 80, H - 80);

    // HUD corner ticks, the same device the panels use.
    g.strokeStyle = "#e84142";
    g.lineWidth = 3;
    const tick = 26;
    [[40, 40, 1, 1], [W - 40, 40, -1, 1], [40, H - 40, 1, -1], [W - 40, H - 40, -1, -1]].forEach(
      ([x, y, dx, dy]) => {
        g.beginPath();
        g.moveTo(x + tick * dx, y);
        g.lineTo(x, y);
        g.lineTo(x, y + tick * dy);
        g.stroke();
      },
    );

    g.fillStyle = "#8d8a82";
    g.font = '500 22px ui-monospace, SFMono-Regular, Menlo, monospace';
    g.fillText("NORR.FUN", 84, 110);
    g.fillText(sealed ? "SEALED CONTRIBUTION ROUND" : "OPEN RAISE", 84, 146);

    g.fillStyle = "#ece9e3";
    g.font = '700 74px ui-monospace, SFMono-Regular, Menlo, monospace';
    g.fillText(`${symbol} / ${base}`, 84, 250);

    g.fillStyle = "#a3a099";
    g.font = mono;
    g.fillText(name, 84, 296);

    // The price, and the move, in the same colours the app uses.
    g.fillStyle = "#ece9e3";
    g.font = '700 92px ui-monospace, SFMono-Regular, Menlo, monospace';
    g.fillText(fmtPrice(priceNow), 84, 420);

    g.fillStyle = changePct >= 0 ? "#3fcf8a" : "#e84142";
    g.font = '700 36px ui-monospace, SFMono-Regular, Menlo, monospace';
    g.fillText(
      `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}% ${changeWindow}`,
      84,
      470,
    );

    // Footer figures, on a rule.
    g.strokeStyle = "#22262b";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(84, 512);
    g.lineTo(W - 84, 512);
    g.stroke();

    g.fillStyle = "#8d8a82";
    g.font = '500 22px ui-monospace, SFMono-Regular, Menlo, monospace';
    const facts = [
      `MARKET CAP  ${compact(marketCap)}`,
      `FILLS  ${fills}`,
      `BY  ${short(creator)}`,
    ];
    facts.forEach((f, i) => g.fillText(f, 84 + i * 360, 556));

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `norr-${symbol.toLowerCase()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    }, "image/png");
  };

  return (
    <button
      onClick={draw}
      className="text-[length:var(--t-fine)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors flex items-center gap-1.5"
      style={done ? { color: "var(--gain)" } : undefined}
    >
      {done ? <FaCheck className="text-[9px]" /> : <FaImage className="text-[9px]" />}
      {done ? "Saved" : "Share card"}
    </button>
  );
};
