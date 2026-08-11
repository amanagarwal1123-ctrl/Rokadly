import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, fmtINR } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

export default function PrintCashPage() {
  const [params] = useSearchParams();
  const storeId = params.get("store_id");
  const businessDate = params.get("business_date");
  const [data, setData] = useState(null);

  useEffect(() => {
    if (storeId && businessDate)
      api.get("/print/cash", { params: { store_id: storeId, business_date: businessDate } })
        .then((r) => setData(r.data)).catch(() => {});
  }, [storeId, businessDate]);

  if (!data) return <div className="p-8 text-sm text-muted-foreground">Loading print view…</div>;
  const closing = data.opening_paise + data.total_in_paise - data.total_out_paise;

  return (
    <div className="print-preview min-h-screen text-black">
      <div className="no-print flex items-center justify-between p-4 border-b border-[hsl(var(--brass-dim)/0.5)] bg-[hsl(var(--ink))] text-[hsl(38_28%_92%)]">
        <Button asChild variant="ghost" size="sm"><Link to="/reconciliation"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link></Button>
        <Button onClick={() => window.print()} data-testid="print-cash-trigger-button"><Printer className="h-4 w-4 mr-1.5" />Print / Save PDF</Button>
      </div>
      <div className="max-w-[800px] mx-auto p-6">
        <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4">
          <div>
            <h1 className="text-xl font-bold">{data.store?.name} — Cash List</h1>
            <p className="text-sm">Business date: {data.business_date}</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold">Rokadly</p>
            <p>Printed {new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
          </div>
        </div>
        <table className="print-table w-full text-sm" data-testid="print-cash-table">
          <thead>
            <tr className="text-left text-xs uppercase">
              <th className="w-[46px] border border-gray-400 px-1.5 py-1">#</th>
              <th className="border border-gray-400 px-1.5 py-1">Type</th>
              <th className="border border-gray-400 px-1.5 py-1">Bill / Voucher</th>
              <th className="border border-gray-400 px-1.5 py-1">Detail</th>
              <th className="border border-gray-400 px-1.5 py-1">Cashier</th>
              <th className="border border-gray-400 px-1.5 py-1 text-right">Cash In</th>
              <th className="border border-gray-400 px-1.5 py-1 text-right">Cash Out</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-400 px-1.5 py-1"></td>
              <td colSpan={4} className="border border-gray-400 px-1.5 py-1 font-bold">Opening cash</td>
              <td className="border border-gray-400 px-1.5 py-1 text-right font-bold">{fmtINR(data.opening_paise)}</td>
              <td className="border border-gray-400"></td>
            </tr>
            {data.rows.map((r, i) => (
              <tr key={i}>
                <td className="border border-gray-400 px-1.5 py-1">{i + 1}</td>
                <td className="border border-gray-400 px-1.5 py-1 uppercase text-xs">{r.kind.replace("_", " ")}</td>
                <td className="border border-gray-400 px-1.5 py-1">{r.bill_no || "—"}</td>
                <td className="border border-gray-400 px-1.5 py-1">{r.customer_name || "—"}</td>
                <td className="border border-gray-400 px-1.5 py-1">{r.cashier_name}</td>
                <td className="border border-gray-400 px-1.5 py-1 text-right">{r.cash_in_paise ? fmtINR(r.cash_in_paise) : "—"}</td>
                <td className="border border-gray-400 px-1.5 py-1 text-right">{r.cash_out_paise ? fmtINR(r.cash_out_paise) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="border border-gray-400 px-1.5 py-1 font-bold text-right">Totals</td>
              <td className="border border-gray-400 px-1.5 py-1 text-right font-bold">{fmtINR(data.total_in_paise)}</td>
              <td className="border border-gray-400 px-1.5 py-1 text-right font-bold">{fmtINR(data.total_out_paise)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="border border-gray-400 px-1.5 py-1 font-bold text-right">Expected closing cash</td>
              <td colSpan={2} className="border border-gray-400 px-1.5 py-1 text-right font-bold">{fmtINR(closing)}</td>
            </tr>
          </tfoot>
        </table>
        <div className="flex justify-between mt-10 pt-6 text-sm">
          <div className="border-t border-black w-[200px] text-center pt-1">Cashier signature</div>
          <div className="border-t border-black w-[200px] text-center pt-1">Manager / Admin signature</div>
        </div>
      </div>
    </div>
  );
}
