'use client';

import { useMemo, useState } from 'react';

type RowData = Record<string, unknown>;

type ApiResult = {
  success: boolean;
  data?: RowData[];
  error?: string;
};

function valueToString(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function DataTable({ rows }: { rows: RowData[] }) {
  const columns = useMemo(() => {
    if (!rows.length) return [];
    return Object.keys(rows[0]);
  }, [rows]);

  if (!rows.length) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">No rows found.</div>;
  }

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="odd:bg-white even:bg-slate-50">
              {columns.map((column) => (
                <td key={`${index}-${column}`} className="whitespace-nowrap border-b border-slate-100 px-3 py-2 text-slate-700">
                  {valueToString(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ZiftTablesPage() {
  const [oid, setOid] = useState('6552');
  const [offerNo, setOfferNo] = useState('');

  const [weeklyRows, setWeeklyRows] = useState<RowData[]>([]);
  const [offerRows, setOfferRows] = useState<RowData[]>([]);

  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [offerLoading, setOfferLoading] = useState(false);

  const [weeklyError, setWeeklyError] = useState('');
  const [offerError, setOfferError] = useState('');

  const fetchWeeklyOffers = async () => {
    setWeeklyLoading(true);
    setWeeklyError('');

    try {
      const response = await fetch(`/api/zift?action=getWeeklyOffer&oid=${encodeURIComponent(oid)}`);
      const result: ApiResult = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch weekly offers');
      }

      setWeeklyRows(result.data || []);
    } catch (error) {
      setWeeklyRows([]);
      setWeeklyError(error instanceof Error ? error.message : 'Failed to fetch weekly offers');
    } finally {
      setWeeklyLoading(false);
    }
  };

  const fetchOfferLines = async () => {
    setOfferLoading(true);
    setOfferError('');

    try {
      if (!offerNo.trim()) {
        throw new Error('Offer No is required');
      }

      const response = await fetch(`/api/zift?action=getOfferLines&offerNo=${encodeURIComponent(offerNo.trim())}`);
      const result: ApiResult = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch offer lines');
      }

      setOfferRows(result.data || []);
    } catch (error) {
      setOfferRows([]);
      setOfferError(error instanceof Error ? error.message : 'Failed to fetch offer lines');
    } finally {
      setOfferLoading(false);
    }
  };

  return (
    <div className="h-[100vh] space-y-6 bg-slate-50 p-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Zift Data Viewer</h1>
        <p className="mt-1 text-slate-600">View data from WeeklyOffersList and Offer Lines in separate tables.</p>
      </div>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="w-full md:w-80">
            <label className="mb-1 block text-sm font-medium text-slate-700">Oid</label>
            <input
              value={oid}
              onChange={(event) => setOid(event.target.value)}
              placeholder="6552"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </div>
          <button
            onClick={fetchWeeklyOffers}
            disabled={weeklyLoading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {weeklyLoading ? 'Loading...' : 'Load WeeklyOffersList'}
          </button>
        </div>

        {weeklyError ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">{weeklyError}</div> : null}

        <DataTable rows={weeklyRows} />
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="w-full md:w-80">
            <label className="mb-1 block text-sm font-medium text-slate-700">Offer No</label>
            <input
              value={offerNo}
              onChange={(event) => setOfferNo(event.target.value)}
              placeholder="Enter Offer No"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </div>
          <button
            onClick={fetchOfferLines}
            disabled={offerLoading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {offerLoading ? 'Loading...' : 'Load Offer Lines'}
          </button>
        </div>

        {offerError ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">{offerError}</div> : null}

        <DataTable rows={offerRows} />
      </section>
    </div>
  );
}
