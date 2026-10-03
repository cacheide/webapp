import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBytecode } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "wagmi/chains";
import { parseEther, formatEther, isAddress } from "viem";
import { escrowAbi, ESCROW_ADDRESS, EXPLORER } from "./abi.js";

const PAGE = 20;
const DUST = parseEther("0.0001");
const STATUS = ["None", "Funded", "Released", "Refunded"];
const COLOR = { Funded: "bg-amber-500/20 text-amber-300", Released: "bg-emerald-500/20 text-emerald-300", Refunded: "bg-sky-500/20 text-sky-300" };
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const reserved = (a) => /^0x0{38}[0-9a-f]{2}$/i.test(a);
const fmtLeft = (s) => {
  if (s <= 0) return "expired";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

function TxStatus({ hash, pending, error }) {
  if (!hash && !pending && !error) return null;
  return (
    <p className="mt-2 text-xs text-slate-400">
      {pending && "Waiting for confirmation… "}
      {hash && <a className="text-sky-400 underline" target="_blank" rel="noreferrer" href={`${EXPLORER}/tx/${hash}`}>View on Basescan</a>}
      {error && <span className="block text-red-400">{error.shortMessage || error.message}</span>}
    </p>
  );
}

function useTx(onDone) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  useEffect(() => { if (isSuccess) onDone?.(); }, [isSuccess]);
  return { writeContract, hash, busy: isPending || confirming, error };
}

function CreateDeal({ me, onDone }) {
  const [seller, setSeller] = useState(""), [amount, setAmount] = useState(""), [hours, setHours] = useState("24");
  const tx = useTx(onDone);
  const okAddr = isAddress(seller);
  const h = Number(hours);
  const { data: code } = useBytecode({ address: okAddr ? seller : undefined, chainId: baseSepolia.id, query: { enabled: okAddr } });
  const isContract = !!code && code !== "0x";
  let blocker = "";
  if (seller && !okAddr) blocker = "Not a valid address. Check every character and the capitalisation.";
  else if (okAddr && reserved(seller)) blocker = "Reserved or burn address: funds sent there can never be released.";
  else if (okAddr && seller.toLowerCase() === ESCROW_ADDRESS?.toLowerCase()) blocker = "The seller cannot be the escrow contract itself.";
  else if (okAddr && seller.toLowerCase() === me.toLowerCase()) blocker = "You cannot be your own seller.";
  const amountOk = /^\d+(\.\d{1,18})?$/.test(amount) && Number(amount) > 0;
  const hoursOk = h >= 1 && h <= 8760;
  const valid = okAddr && !blocker && amountOk && hoursOk;
  const submit = () => tx.writeContract({
    address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "createDeal", chainId: baseSepolia.id,
    args: [seller, BigInt(Math.floor(h * 3600))], value: parseEther(amount),
  });
  const input = "w-full rounded-lg bg-slate-900 border border-slate-700 p-3 text-sm";
  return (
    <div className="rounded-2xl border border-slate-800 p-4 space-y-3">
      <h2 className="font-semibold">New deal</h2>
      <input className={input} placeholder="Seller address (0x…)" value={seller} onChange={(e) => setSeller(e.target.value.trim())} />
      <input className={input} placeholder="Amount (ETH)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <input className={input} placeholder="Deadline (1 to 8760 hours)" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
      {blocker && <p className="text-xs text-red-400">{blocker}</p>}
      {valid && isContract && <p className="text-xs text-amber-300">This seller is a contract or smart-account wallet. If it cannot receive plain ETH, Release will fail and you must wait for the deadline to reclaim.</p>}
      {hoursOk && h < 24 && <p className="text-xs text-amber-300">Short deadline: the seller may not have time to deliver.</p>}
      {hoursOk && h > 720 && <p className="text-xs text-amber-300">Long deadline: if something goes wrong, your funds stay locked until then.</p>}
      {valid && <p className="text-xs text-slate-300 break-all">You lock {amount} ETH for {seller}. Only you can release it. You can take it back after {new Date(Date.now() + h * 3600 * 1000).toLocaleString()}.</p>}
      <button disabled={!valid || tx.busy} onClick={submit} className="w-full rounded-lg bg-indigo-600 p-3 font-medium disabled:opacity-40">
        {tx.busy ? "Confirming…" : "Lock funds"}
      </button>
      <TxStatus hash={tx.hash} pending={tx.busy} error={tx.error} />
    </div>
  );
}

function DealCard({ d, me, now, onDone }) {
  const tx = useTx(onDone);
  const status = STATUS[d.status];
  const isBuyer = d.buyer.toLowerCase() === me.toLowerCase();
  const secs = Number(d.deadline) - now;
  const expired = secs <= 0;
  const act = (fn) => tx.writeContract({ address: ESCROW_ADDRESS, abi: escrowAbi, functionName: fn, args: [d.id], chainId: baseSepolia.id });
  return (
    <div className="rounded-2xl border border-slate-800 p-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Deal #{d.id.toString()}</span>
        <span className={`rounded-full px-3 py-1 text-xs ${COLOR[status]}`}>{status}</span>
      </div>
      <p className="mt-2 text-lg">{formatEther(d.amount)} ETH</p>
      <p className="text-xs text-slate-400">{isBuyer ? `You → ${short(d.seller)}` : `${short(d.buyer)} → You`}</p>
      <p className="text-xs text-slate-400">Deadline: {new Date(Number(d.deadline) * 1000).toLocaleString()}{status === "Funded" ? ` (${fmtLeft(secs)})` : ""}</p>
      {!isBuyer && status === "Funded" && (
        <p className={`mt-3 rounded-lg p-2 text-xs ${secs < 86400 ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300"}`}>
          You are the seller. {expired ? "The deadline has passed, so the buyer can take this money back at any time." : `The buyer can take this money back in ${fmtLeft(secs)}.`}{" "}
          {secs < 86400 ? "Short window: do not ship unless you trust this buyer." : "Deliver before then."}
        </p>
      )}
      {isBuyer && status === "Funded" && (
        <div className="mt-3 flex gap-2">
          <button disabled={tx.busy} onClick={() => act("release")} className="flex-1 rounded-lg bg-emerald-600 p-2 text-sm disabled:opacity-40">{tx.busy ? "…" : "Release"}</button>
          <button disabled={tx.busy || !expired} onClick={() => act("reclaim")} className="flex-1 rounded-lg bg-slate-700 p-2 text-sm disabled:opacity-40">{expired ? "Reclaim" : "Reclaim (after deadline)"}</button>
        </div>
      )}
      <TxStatus hash={tx.hash} pending={tx.busy} error={tx.error} />
    </div>
  );
}

export default function App() {
  const { address } = useAccount();
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [page, setPage] = useState(0);
  const [hideDust, setHideDust] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15000); return () => clearInterval(t); }, []);
  const on = !!address && !!ESCROW_ADDRESS;
  const { data: count, refetch: refetchCount, error: countError } = useReadContract({
    address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "dealCountOf", args: [address], chainId: baseSepolia.id, query: { enabled: on },
  });
  const total = Number(count ?? 0n);
  const end = Math.max(total - page * PAGE, 0);
  const start = Math.max(end - PAGE, 0);
  const limit = end - start;
  const { data: deals, refetch: refetchDeals, isLoading, error: dealsError } = useReadContract({
    address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "dealsOf", args: [address, BigInt(start), BigInt(limit)], chainId: baseSepolia.id,
    query: { enabled: on && count !== undefined && limit > 0 },
  });
  const refetch = () => { refetchCount(); refetchDeals(); };
  const err = countError || dealsError;
  const list = [...(deals ?? [])].reverse().filter((d) => !hideDust || d.amount >= DUST);
  const pages = Math.max(Math.ceil(total / PAGE), 1);
  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <header className="flex items-center justify-between"><h1 className="text-xl font-bold">Onchain Escrow</h1><ConnectButton showBalance={false} /></header>
      {!ESCROW_ADDRESS && <p className="text-red-400 text-sm">Set VITE_ESCROW_ADDRESS to the deployed contract.</p>}
      {on ? (<>
        <CreateDeal me={address} onDone={refetch} />
        <h2 className="font-semibold pt-2">Your deals</h2>
        {err && <p className="text-xs text-red-400 break-all">{err.shortMessage || err.message}</p>}
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={hideDust} onChange={(e) => setHideDust(e.target.checked)} /> Hide tiny deals under 0.0001 ETH (spam)
        </label>
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {count !== undefined && total === 0 && <p className="text-sm text-slate-400">No deals yet.</p>}
        {list.map((d) => <DealCard key={d.id.toString()} d={d} me={address} now={now} onDone={refetch} />)}
        {total > PAGE && (
          <div className="flex items-center justify-between text-xs text-slate-400">
            <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg bg-slate-800 px-3 py-2 disabled:opacity-40">Newer</button>
            <span>Page {page + 1} of {pages} · {total} deals</span>
            <button disabled={start === 0} onClick={() => setPage(page + 1)} className="rounded-lg bg-slate-800 px-3 py-2 disabled:opacity-40">Older</button>
          </div>
        )}
      </>) : <p className="text-sm text-slate-400">Connect a wallet on Base Sepolia to start.</p>}
    </main>
  );
}
