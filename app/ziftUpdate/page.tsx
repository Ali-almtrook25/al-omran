'use client';

import { useState } from 'react';

type SyncResponse = {
  success: boolean;
  data?: {
    oid?: number;
    sourceItems?: number;
    totalSourceItems?: number;
    itemsUpdated?: number;
    rowsAffected?: number;
    chunk?: {
      offset: number;
      batchSize: number;
      processedInChunk: number;
      nextOffset: number;
      hasMore: boolean;
    };
    stages?: Array<{
      step: string;
      message: string;
      timestamp: string;
    }>;
  };
  message?: string;
  error?: string;
};

export default function ZiftUpdatePage() {
  const [oid, setOid] = useState('6552');
  const [offerNo, setOfferNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<SyncResponse['data'] | null>(null);
  const [uiStages, setUiStages] = useState<string[]>([]);

  const runUpdate = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    setUiStages(['بدء العملية: التحقق من المدخلات']);

    try {
      const oidNumber = Number(oid);
      if (Number.isNaN(oidNumber)) {
        throw new Error('Oid يجب أن يكون رقمًا صحيحًا');
      }

      if (!offerNo.trim()) {
        throw new Error('Offer No مطلوب');
      }

      const batchSize = 100;
      const maxChunks = 100;

      let hasMore = true;
      let offset = 0;
      let chunksProcessed = 0;
      let totalSourceItems = 0;
      let totalItemsUpdated = 0;
      let totalRowsAffected = 0;
      const combinedStages: NonNullable<SyncResponse['data']>['stages'] = [];

      while (hasMore) {
        chunksProcessed += 1;
        if (chunksProcessed > maxChunks) {
          throw new Error('تم إيقاف العملية لأن عدد الدفعات كبير جدًا. أعد المحاولة بمعايير أضيق.');
        }

        setUiStages((prev) => [...prev, `إرسال الدفعة رقم ${chunksProcessed} إلى الخادم`]);

        const response = await fetch('/api/zift', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'updateCouponDiscountByOid',
            oid: oidNumber,
            offerNo: offerNo.trim(),
            offset,
            batchSize,
          }),
        });

        const payload: SyncResponse = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'فشل تنفيذ التحديث');
        }

        const chunkData = payload.data;
        totalSourceItems = Number(chunkData?.totalSourceItems ?? totalSourceItems);
        totalItemsUpdated += Number(chunkData?.itemsUpdated ?? 0);
        totalRowsAffected += Number(chunkData?.rowsAffected ?? 0);
        if (chunkData?.stages && chunkData.stages.length > 0) {
          combinedStages.push(...chunkData.stages);
        }

        hasMore = Boolean(chunkData?.chunk?.hasMore);
        offset = Number(chunkData?.chunk?.nextOffset ?? offset);

        setUiStages((prev) => [
          ...prev,
          `اكتملت الدفعة ${chunksProcessed}: ${(chunkData?.chunk?.nextOffset ?? 0)}/${totalSourceItems}`,
        ]);
      }

      setResult({
        oid: oidNumber,
        sourceItems: totalSourceItems,
        totalSourceItems,
        itemsUpdated: totalItemsUpdated,
        rowsAffected: totalRowsAffected,
        chunk: {
          offset: 0,
          batchSize,
          processedInChunk: totalSourceItems,
          nextOffset: totalSourceItems,
          hasMore: false,
        },
        stages: combinedStages,
      });
      setMessage('تم تنفيذ التحديث بنجاح على كل الدفعات');
      setUiStages((prev) => [...prev, 'اكتملت عملية التحديث']);
    } catch (runError) {
      setResult(null);
      setError(runError instanceof Error ? runError.message : 'حدث خطأ أثناء التحديث');
      setUiStages((prev) => [...prev, 'فشلت عملية التحديث']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100vh] bg-slate-50 p-6">
      <div className="h-full space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">تحديث Coupon Discount</h1>
          <p className="mt-2 text-slate-600">
            الصفحة تقوم بتنفيذ مزامنة من جدول WeeklyOffersList إلى جدول Trans_ Sales Entry بناءً على Oid.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="mb-2 block text-sm font-medium text-slate-700">Oid</label>
          <div className="mb-3">
            <input
              value={oid}
              onChange={(event) => setOid(event.target.value)}
              placeholder="6552"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </div>

          <label className="mb-2 block text-sm font-medium text-slate-700">Offer No_</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={offerNo}
              onChange={(event) => setOfferNo(event.target.value)}
              placeholder="PR-9472"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
            <button
              onClick={runUpdate}
              disabled={loading}
              className="rounded-lg bg-slate-900 px-5 py-2 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? 'جاري التحديث...' : 'تنفيذ التحديث'}
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">{error}</div>
          ) : null}

          {message ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">{message}</div>
          ) : null}

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-700">مراحل التنفيذ (واجهة المستخدم)</p>
            {uiStages.length === 0 ? (
              <p className="text-sm text-slate-500">لا توجد مراحل بعد</p>
            ) : (
              <ul className="space-y-1 text-sm text-slate-700">
                {uiStages.map((stage, index) => (
                  <li key={`${stage}-${index}`}>{index + 1}. {stage}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {result ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">نتيجة التحديث</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Oid</p>
                <p className="text-base font-semibold text-slate-900">{String(result.oid ?? '')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Source Items</p>
                <p className="text-base font-semibold text-slate-900">{String(result.sourceItems ?? 0)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Items Updated</p>
                <p className="text-base font-semibold text-slate-900">{String(result.itemsUpdated ?? 0)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Rows Affected</p>
                <p className="text-base font-semibold text-slate-900">{String(result.rowsAffected ?? 0)}</p>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-700">مراحل التنفيذ (من الخادم)</p>
              {result.stages && result.stages.length > 0 ? (
                <ul className="space-y-1 text-sm text-slate-700">
                  {result.stages.map((stage, index) => (
                    <li key={`${stage.timestamp}-${index}`}>
                      {index + 1}. [{stage.step}] {stage.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">لم يتم استلام مراحل من الخادم.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
