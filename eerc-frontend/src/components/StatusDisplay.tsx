
import { FaExclamationTriangle, FaInfoCircle, FaCheckCircle, FaSpinner } from 'react-icons/fa'; interface StatusDisplayProps { status: string;
} export const StatusDisplay = ({ status }: StatusDisplayProps) => { if (!status) return null; const isError = status.startsWith("❌"); const isSuccess = status.startsWith("✅"); const isLoading = status.startsWith("⏳"); let icon; let textColor = "text-[var(--ink-2)]"; if (isError) { icon = <FaExclamationTriangle className="text-[var(--falu)]" />; textColor = "text-[var(--falu)]";
  } else if (isSuccess) { icon = <FaCheckCircle className="text-[var(--lichen)]" />; textColor = "text-[var(--lichen)]";
  } else if (isLoading) { icon = <FaSpinner className="animate-spin text-[var(--fjord)]" />; textColor = "text-[var(--fjord)]";
  } else { icon = <FaInfoCircle className="text-[var(--ink-2)]" />;
  } return (
    <div className={`mt-6 p-4 bg-[var(--snow-sunk)] border border-[var(--rule)] flex items-center gap-4 ${textColor}`}>
      {icon}
      <p className="font-mono text-[length:var(--t-base)] break-all">{status}</p>
    </div>
  );
};