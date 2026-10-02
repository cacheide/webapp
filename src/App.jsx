import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseEther, formatEther, isAddress } from "viem";
import { baseSepolia } from "wagmi/chains";
import { escrowAbi, ESCROW_ADDRESS, EXPLORER } from "./abi.js";

const STATUS = ["None", "Funded", "Released", "Refunded"];
const COLOR = { Funded: "bg-amber-500/20 text-amber-300", Released: "bg-emerald-500/20 text-emerald-300", Refunded: "bg-sky-500/20 text-sky-300" };
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

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

function CreateDeal({ onDone }) {
  const [seller, setSeller] = useState(""), [amount, setAmount] = useState(""), [hours, setHours] = useState("24");
  const tx = useTx(onDone);
  const valid = isAddress(seller) && Number(amount) > 0 && Number(hours) >= 1 && Number(hours) <= 8760;
  const submit = () => tx.writeContract({
    address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "createDeal",
    chainId: baseSepolia.id,
    args: [seller, BigInt(Math.floor(Number(hours) * 3600))],
    value: parseEther(amount),
  });
  const input = "w-full rounded-lg bg-slate-900 border border-slate-700 p-3 text-sm";
  return (
    <div className="rounded-2xl border border-slate-800 p-4 space-y-3">
      <h2 className="font-semibold">New deal</h2>
      <input className={input} placeholder="Seller address (0x…)" value={seller} onChange={(e) => setSeller(e.target.value.trim())} />
      <input className={input} placeholder="Amount (ETH)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <input className={input} placeholder="Deadline (1 to 8760 hours)" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} />
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
  const expired = now >= Number(d.deadline);
  const act = (fn) => tx.writeContract({ address: ESCROW_ADDRESS, abi: escrowAbi, functionName: fn, args: [d.id], chainId: baseSepolia.id });
  return (
    <div className="rounded-2xl border border-slate-800 p-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Deal #{d.id.toString()}</span>
        <span className={`rounded-full px-3 py-1 text-xs ${COLOR[status]}`}>{status}</span>
      </div>
      <p className="mt-2 text-lg">{formatEther(d.amount)} ETH</p>
      <p className="text-xs text-slate-400">{isBuyer ? `You → ${short(d.seller)}` : `${short(d.buyer)} → You`}</p>
      <p className="text-xs text-slate-400">Deadline: {new Date(Number(d.deadline) * 1000).toLocaleString()}</p>
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
  useEffect(() => { const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15000); return () => clearInterval(t); }, []);
  const [shown, setShown] = useState(20);
  const on = !!address && !!ESCROW_ADDRESS;
  const { data: count, refetch: refetchCount, error: countError } = useReadContract({
    address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "dealCountOf", args: [address], chainId: baseSepolia.id, query: { enabled: on },
  });
  const total = Number(count ?? 0n);
  const start = Math.max(total - shown, 0);
  const { data: deals, refetch: refetchDeals, isLoading } = useReadContract({
    address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "dealsOf", args: [address, BigInt(start), BigInt(shown)], chainId: baseSepolia.id, query: { enabled: on && count !== undefined },
  });
  const refetch = () => { refetchCount(); refetchDeals(); };
  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <header className="flex items-center justify-between"><h1 className="text-xl font-bold">Onchain Escrow</h1><ConnectButton showBalance={false} /></header>
      {!ESCROW_ADDRESS && <p className="text-red-400 text-sm">Set VITE_ESCROW_ADDRESS to the deployed contract.</p>}
      {address && ESCROW_ADDRESS ? (<>
        <CreateDeal onDone={refetch} />
        <h2 className="font-semibold pt-2">Your deals</h2>{countError && <p className="text-xs text-red-400 break-all">{countError.shortMessage || countError.message}</p>}
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {deals?.length === 0 && <p className="text-sm text-slate-400">No deals yet.</p>}
        {deals && [...deals].reverse().map((d) => <DealCard key={d.id.toString()} d={d} me={address} now={now} onDone={refetch} />)}
        {total > shown && shown < 50 && <button onClick={() => setShown(shown + 10)} className="w-full rounded-lg bg-slate-800 p-2 text-sm">Show older</button>}
      </>) : <p className="text-sm text-slate-400">Connect a wallet on Base Sepolia to start.</p>}
    </main>
  );
}
