import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, fmtINR } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

export default function PrintNonCashPage() {
  const [params] = useSearchParams();
  const storeId = params.get("store_id");
  const businessDate = params.get("business_date");
  const [data, setData] = useState(null);

  useEffect(() => {
    if (storeId && businessDate)
      api.get("/print/noncash", { params: { store_id: storeId, business_date: businessDate } })
        .then((r) => setData(r.data)).catch(() => {});
  }, [storeId, businessDate]);

  if (!data) return <div className="p-8 text-sm text-muted-foreground">Loading print view…</div>;

  return (
    <div className="print-preview min-h-screen text-black">
      <div className="no-print flex items-center justify-between p-4 border-b border-[hsl(var(--brass-dim)/0.5)] bg-[hsl(var(--ink))] text-[hsl(38_28%_92%)]">
        <Button asChild variant="ghost" size="sm"><Link to="/reconciliation"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link></Button>
        <Button onClick={() => window.print()} data-testid="print-trigger-button"><Printer className="h-4 w-4 mr-1.5" />Print / Save PDF</Button>
      </div>
      <div className="max-w-[800px] mx-auto p-6">
        <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4">
          <div>
            <h1 className="text-xl font-bold">{data.store?.name} — Non-Cash Receipts</h1>
            <p className="text-sm">Business date: {data.business_date} · {data.total_items} entries · Total {fmtINR(data.total_paise)}</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold">Rokadly</p>
            <p>Printed {new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
          </div>
        </div>
        {data.groups.map((g) => (
          <div key={g.group_key} className="mb-5">
            <h2 className="font-bold text-sm uppercase tracking-wide border-b border-black pb-1 mb-1">
              {g.group_label} — {fmtINR(g.total_paise)}
            </h2>
            <table className="print-table w-full text-sm" data-testid={`print-group-${g.group_key}`}>
              <thead>
                <tr className="text-left text-xs uppercase">
                  <th className="w-[46px] border border-gray-400 px-1.5 py-1">#</th>
                  <th className="border border-gray-400 px-1.5 py-1">Bill / Ref</th>
                  <th className="border border-gray-400 px-1.5 py-1">Party</th>
                  <th className="border border-gray-400 px-1.5 py-1">Cheque/Detail</th>
                  <th className="border border-gray-400 px-1.5 py-1">Cashier</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-right">Amount</th>
                  <th className="border border-gray-400 px-1.5 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((it) => (
                  <tr key={it.serial} className={it.recon_status === "pending" ? "pending-row" : ""}>
                    <td className="border border-gray-400 px-1.5 py-1 font-bold">{it.serial}</td>
                    <td className="border border-gray-400 px-1.5 py-1">{it.bill_no || "—"}</td>
                    <td className="border border-gray-400 px-1.5 py-1">{it.customer_name || "—"}</td>
                    <td className="border border-gray-400 px-1.5 py-1">{it.cheque_no || it.other_label || "—"}</td>
                    <td className="border border-gray-400 px-1.5 py-1">{it.cashier_name}</td>
                    <td className="border border-gray-400 px-1.5 py-1 text-right font-semibold">{fmtINR(it.amount_paise)}</td>
                    <td className="border border-gray-400 px-1.5 py-1 uppercase text-xs">{it.recon_status}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="border border-gray-400 px-1.5 py-1 font-bold text-right">Group total</td>
                  <td className="border border-gray-400 px-1.5 py-1 text-right font-bold">{fmtINR(g.total_paise)}</td>
                  <td className="border border-gray-400"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
        <div className="flex justify-between mt-10 pt-6 text-sm">
          <div className="border-t border-black w-[200px] text-center pt-1">Accountant signature</div>
          <div className="border-t border-black w-[200px] text-center pt-1">Manager / Admin signature</div>
        </div>
      </div>
    </div>
  );
}
