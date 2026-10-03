import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBytecode } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "wagmi/chains";
import { parseEther, formatEther, isAddress } from "viem";
import { escrowAbi, ESCROW_ADDRESS, EXPLORER } from "./abi.js";
import Background from "./Background.jsx";

const PAGE = 20;
const DUST = parseEther("0.0001");
const ST = {
  1: { label: "In Escrow", glyph: "●", cls: "s-hold" },
  2: { label: "Released", glyph: "✓", cls: "s-ok" },
  3: { label: "Cancelled", glyph: "✕", cls: "s-off" },
};
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const reserved = (a) => /^0x0{38}[0-9a-f]{2}$/i.test(a);
const fmtLeft = (s) => {
  if (s <= 0) return "expired";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

function Connect() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
        if (!mounted) return null;
        if (!account) return <button className="btn btn-primary" onClick={openConnectModal}>Connect Wallet</button>;
        if (chain.unsupported) return <button className="btn btn-ghost btn-sm" onClick={openChainModal}>Wrong network</button>;
        return <button className="chip mono" onClick={openAccountModal}><span className="dot" />{short(account.address)}</button>;
      }}
    </ConnectButton.Custom>
  );
}

function TxInfo({ hash, pending, error }) {
  if (!hash && !pending && !error) return null;
  return (
    <div className="mt-3 text-xs text-slate-400">
      {pending && <span>Waiting for network confirmation… </span>}
      {hash && <span className="mono">{short(hash)} · <a className="link" target="_blank" rel="noreferrer" href={`${EXPLORER}/tx/${hash}`}>View transaction ↗</a></span>}
      {error && <p className="note bad mt-2">{error.shortMessage || error.message}</p>}
    </div>
  );
}

function useTx(onDone) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  useEffect(() => { if (isSuccess) onDone?.(); }, [isSuccess]);
  return { writeContract, hash, busy: isPending || confirming, error };
}

function CreateEscrow({ me, onDone }) {
  const [seller, setSeller] = useState(""), [amount, setAmount] = useState(""), [hours, setHours] = useState("24");
  const tx = useTx(onDone);
  const okAddr = isAddress(seller);
  const h = Number(hours);
  const { data: code } = useBytecode({ address: okAddr ? seller : undefined, chainId: baseSepolia.id, query: { enabled: okAddr } });
  const isContract = !!code && code !== "0x";
  let blocker = "";
  if (seller && !okAddr) blocker = "Not a valid address. Check every character and the capitalisation.";
  else if (okAddr && reserved(seller)) blocker = "Reserved or burn address: funds sent there can never be released.";
  else if (okAddr && seller.toLowerCase() === ESCROW_ADDRESS?.toLowerCase()) blocker = "The recipient cannot be the escrow contract itself.";
  else if (okAddr && seller.toLowerCase() === me.toLowerCase()) blocker = "You cannot be your own recipient.";
  const amountOk = /^\d+(\.\d{1,18})?$/.test(amount) && Number(amount) > 0;
  const hoursOk = h >= 1 && h <= 8760;
  const valid = okAddr && !blocker && amountOk && hoursOk;
  const submit = () => tx.writeContract({
    address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "createDeal", chainId: baseSepolia.id,
    args: [seller, BigInt(Math.floor(h * 3600))], value: parseEther(amount),
  });
  return (
    <div className="space-y-4">
      <section className="card">
        <p className="step">01 · SENDER</p>
        <input className="field mono" readOnly value={me} />
        <p className="mt-2 text-xs text-slate-500">You (buyer). Only this address can release or cancel the escrow.</p>
      </section>
      <section className="card">
        <p className="step">02 · RECIPIENT</p>
        <input className="field mono" placeholder="0x… recipient address" value={seller} onChange={(e) => setSeller(e.target.value.trim())} />
        {blocker && <p className="note bad mt-3">{blocker}</p>}
        {valid && isContract && <p className="note warn mt-3">This recipient is a contract or smart-account wallet. If it cannot receive plain ETH, Release will fail and you must wait for the deadline.</p>}
      </section>
      <section className="card">
        <p className="step">03 · ASSET AND AMOUNT</p>
        <div className="grid grid-cols-3 gap-3">
          <div><p className="label">Asset</p><input className="field" readOnly value="ETH" /></div>
          <div className="col-span-2"><p className="label">Amount</p><input className="field mono" placeholder="0.00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        </div>
      </section>
      <section className="card">
        <p className="step">04 · NETWORK AND DEADLINE</p>
        <div className="grid grid-cols-2 gap-3">
          <div><p className="label">Network</p><input className="field" readOnly value="Base Sepolia" /></div>
          <div><p className="label">Deadline (hours)</p><input className="field mono" inputMode="decimal" placeholder="1 to 8760" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
        </div>
        {hoursOk && h < 24 && <p className="note warn mt-3">Short deadline: the recipient may not have time to deliver.</p>}
        {hoursOk && h > 720 && <p className="note warn mt-3">Long deadline: if something goes wrong, your funds stay locked until then.</p>}
      </section>
      <section className="card">
        <p className="step">05 · CONFIRMATION</p>
        <div className="kv"><span>Sender</span><span className="mono">{short(me)}</span></div>
        <div className="kv"><span>Recipient</span><span className="mono">{okAddr ? seller : "—"}</span></div>
        <div className="kv"><span>Amount</span><span className="mono">{amountOk ? `${amount} ETH` : "—"}</span></div>
        <div className="kv"><span>Network</span><span>Base Sepolia · 84532</span></div>
        <div className="kv"><span>Cancel opens</span><span>{hoursOk ? new Date(Date.now() + h * 3600 * 1000).toLocaleString() : "—"}</span></div>
        <button className="btn btn-primary mt-4 w-full" disabled={!valid || tx.busy} onClick={submit}>{tx.busy ? "Confirming…" : "Create escrow"}</button>
        <TxInfo hash={tx.hash} pending={tx.busy} error={tx.error} />
      </section>
    </div>
  );
}

function EscrowCard({ d, me, now, onDone }) {
  const tx = useTx(onDone);
  const isBuyer = d.buyer.toLowerCase() === me.toLowerCase();
  const secs = Number(d.deadline) - now;
  const expired = secs <= 0;
  const s = tx.busy ? { label: "Pending", glyph: "◌", cls: "s-pend" } : ST[d.status] || ST[1];
  const funded = Number(d.status) === 1;
  const act = (fn) => tx.writeContract({ address: ESCROW_ADDRESS, abi: escrowAbi, functionName: fn, args: [d.id], chainId: baseSepolia.id });
  return (
    <article className="card">
      <div className="flex items-center justify-between">
        <span className="mono text-sm text-slate-400">ESCROW #{d.id.toString()}</span>
        <span className={`badge ${s.cls}`}><span>{s.glyph}</span>{s.label}</span>
      </div>
      <p className="mono mt-3 text-2xl">{formatEther(d.amount)} <span className="text-base text-slate-400">ETH</span></p>
      <div className="mt-3">
        <div className="kv"><span>Sender</span><span className="mono" title={d.buyer}>{isBuyer ? "You" : short(d.buyer)}</span></div>
        <div className="kv"><span>Recipient</span><span className="mono" title={d.seller}>{isBuyer ? short(d.seller) : "You"}</span></div>
        <div className="kv"><span>Network</span><span>Base Sepolia</span></div>
        <div className="kv"><span>Deadline</span><span>{new Date(Number(d.deadline) * 1000).toLocaleString()}{funded ? ` · ${fmtLeft(secs)}` : ""}</span></div>
      </div>
      {!isBuyer && funded && (
        <p className={`note mt-3 ${secs < 86400 ? "bad" : "warn"}`}>
          You are the recipient. {expired ? "The deadline has passed, so the sender can take this money back at any time." : `The sender can take this money back in ${fmtLeft(secs)}.`}{" "}
          {secs < 86400 ? "Short window: do not ship unless you trust this sender." : "Deliver before then."}
        </p>
      )}
      {isBuyer && funded && (
        <div className="mt-4 flex gap-3">
          <button className="btn btn-primary btn-sm flex-1" disabled={tx.busy} onClick={() => act("release")}>Release</button>
          <button className="btn btn-ghost btn-sm flex-1" disabled={tx.busy || !expired} onClick={() => act("reclaim")}>{expired ? "Cancel" : "Cancel after deadline"}</button>
        </div>
      )}
      <TxInfo hash={tx.hash} pending={tx.busy} error={tx.error} />
    </article>
  );
}

function Landing() {
  return (
    <main className="view relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pb-16 text-center">
      <h1 className="hero-title">CACHE</h1>
      <p className="hero-sub">ON CHAIN ESCROW</p>
      <p className="hero-copy">Secure on-chain escrow for digital transactions. Funds are held by a verified smart contract and only the sender can release them.</p>
      <div className="mt-7"><Connect /></div>
      <p className="foot-note">Base Sepolia testnet</p>
    </main>
  );
}

export default function App() {
  const { address } = useAccount();
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [tab, setTab] = useState("create");
  const [filter, setFilter] = useState("all");
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
  const mine = (d) => d.buyer.toLowerCase() === address?.toLowerCase();
  const list = [...(deals ?? [])].reverse()
    .filter((d) => !hideDust || d.amount >= DUST)
    .filter((d) => filter === "all" || (filter === "sending" ? mine(d) : !mine(d)));
  const pages = Math.max(Math.ceil(total / PAGE), 1);
  const focus = !on ? 0 : tab === "create" ? 1 : 2;
  return (
    <>
      <Background focus={focus} />
      {!on ? <Landing /> : (
        <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-16">
          <header className="flex flex-wrap items-center justify-between gap-3 py-5">
            <div><div className="wordmark">CACHE</div><div className="wordmark-sub">ON CHAIN ESCROW</div></div>
            <div className="flex items-center gap-2"><span className="chip net">Base Sepolia</span><Connect /></div>
          </header>
          <nav className="tabs">
            <button className={tab === "create" ? "on" : ""} onClick={() => setTab("create")}>Create escrow</button>
            <button className={tab === "list" ? "on" : ""} onClick={() => setTab("list")}>Escrows{total ? ` (${total})` : ""}</button>
          </nav>
          <div key={tab} className="view space-y-4 pt-5">
            {tab === "create" ? (
              <CreateEscrow me={address} onDone={() => { refetch(); setTab("list"); }} />
            ) : (<>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="seg">
                  {[["all", "All"], ["sending", "Sending"], ["receiving", "Receiving"]].map(([k, l]) => (
                    <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={hideDust} onChange={(e) => setHideDust(e.target.checked)} /> Hide under 0.0001 ETH
                </label>
              </div>
              {err && <p className="note bad break-all">{err.shortMessage || err.message}</p>}
              {isLoading && <p className="text-sm text-slate-400">Loading escrows…</p>}
              {count !== undefined && total === 0 && <p className="text-sm text-slate-400">No escrows yet. Create your first one.</p>}
              {list.map((d) => <EscrowCard key={d.id.toString()} d={d} me={address} now={now} onDone={refetch} />)}
              {total > PAGE && (
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</button>
                  <span>Page {page + 1} of {pages} · {total} escrows</span>
                  <button className="btn btn-ghost btn-sm" disabled={start === 0} onClick={() => setPage(page + 1)}>Older</button>
                </div>
              )}
            </>)}
          </div>
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500">
            <span className="mono">Contract {ESCROW_ADDRESS ? short(ESCROW_ADDRESS) : "not set"}</span>
            {ESCROW_ADDRESS && <a className="link" target="_blank" rel="noreferrer" href={`${EXPLORER}/address/${ESCROW_ADDRESS}#code`}>Verified on Basescan ↗</a>}
          </footer>
        </div>
      )}
      {!ESCROW_ADDRESS && <p className="relative z-10 p-4 text-center text-sm text-red-400">Set VITE_ESCROW_ADDRESS to the deployed contract.</p>}
    </>
  );
}
