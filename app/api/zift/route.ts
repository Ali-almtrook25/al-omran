import { NextRequest, NextResponse } from 'next/server';
import { getSqlPool, getSqlPool2, sql } from '@/lib/sqlServer';

export const runtime = 'nodejs';
export const maxDuration = 120;

type ApiResponse = {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
};

type WeeklySourceRow = {
  Oid: number;
  No_: string;
  DealPerPiece: number | null;
};

type UpdateStage = {
  step: string;
  message: string;
  timestamp: string;
};

const weeklyOffersSourceSelect = `
SELECT TOP (1000)
  [Oid],
  [No_],
  [DealPerPiece]
FROM [BackOffice].[dbo].[WeeklyOffersList]
WHERE [Oid] = @oid
`;

const offerLinesSelect = `
SELECT
  ol.[No_],
  ol.[Unit of Measure],
  tse.[Coupon Discount],
  iuom.[Qty_ per Unit of Measure],
  tse.[Store No_],
  tse.[POS Terminal No_],
  tse.[Transaction No_],
  tse.[Line No_]
FROM [Al Amer Market Live$Offer Line] ol WITH (NOLOCK)
LEFT JOIN [Al Amer Market Live$Item] i WITH (NOLOCK)
  ON i.[No_] = ol.[No_]
LEFT JOIN [Al Amer Market Live$Purchase Price] pp WITH (NOLOCK)
  ON pp.[Item No_] = ol.[No_]
  AND pp.[Unit of Measure Code] = ol.[Unit of Measure]
  AND pp.[Vendor No_] = i.[Vendor No_]
LEFT JOIN [Al Amer Market Live$Sales Price] sp WITH (NOLOCK)
  ON sp.[Item No_] = ol.[No_]
  AND sp.[Unit of Measure Code] = ol.[Unit of Measure]
  AND sp.[Sales Code] = 'STORES'
LEFT JOIN [Al Amer Market Live$Item Unit of Measure] iuom WITH (NOLOCK)
  ON iuom.[Item No_] = ol.[No_]
  AND iuom.[Code] = ol.[Unit of Measure]
LEFT JOIN [Al Amer Market Live$Offer] o WITH (NOLOCK)
  ON o.[No_] = ol.[Offer No_]
LEFT JOIN [Al Amer Market Live$Validation Period] vp WITH (NOLOCK)
  ON vp.[ID] = o.[Validation Period ID]
LEFT JOIN [Al Amer Market Live$Trans_ Sales Entry] tse WITH (NOLOCK)
  ON tse.[Item No_] = ol.[No_]
  AND tse.[Promotion No_] = ol.[Offer No_]
  AND tse.[Unit of Measure] = ol.[Unit of Measure]
  AND tse.[Date] >= vp.[Starting Date]
  AND tse.[Date] <= vp.[Ending Date]
WHERE ol.[Offer No_] = @offerNo
ORDER BY ol.[No_] ASC
`;

const updateCouponDiscountByItemAndOid = `
UPDATE tse
SET tse.[Coupon Discount] = @couponDiscount
FROM [Al Amer Market Live$Trans_ Sales Entry] tse
WHERE tse.[Item No_] = @itemNo
  AND CONVERT(NVARCHAR(50), tse.[Promotion No_]) = @offerNo
`;

function isTimeoutLikeError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('request failed to complete in') ||
    message.includes('gateway timeout')
  );
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action') || 'getWeeklyOffer';

  try {
    const pool = await getSqlPool();

    if (action === 'getWeeklyOffer') {
      const oid = Number(request.nextUrl.searchParams.get('oid') ?? 6552);

      if (Number.isNaN(oid)) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'oid must be a number' }, { status: 400 });
      }

      const result = await pool.request().input('oid', sql.Int, oid).query(weeklyOffersSourceSelect);
      return NextResponse.json<ApiResponse>({ success: true, data: result.recordset });
    }

    if (action === 'getOfferLines') {
      const pool2 = await getSqlPool2();
      const offerNo = String(request.nextUrl.searchParams.get('offerNo') || '');
      const salesCode = String(request.nextUrl.searchParams.get('salesCode') || 'STORES');

      if (!offerNo) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'offerNo is required' }, { status: 400 });
      }

      const result = await pool2
        .request()
        .input('offerNo', sql.NVarChar(50), offerNo)
        .input('salesCode', sql.NVarChar(30), salesCode)
        .query(offerLinesSelect);

      return NextResponse.json<ApiResponse>({ success: true, data: result.recordset });
    }

    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Invalid action. Use getWeeklyOffer or getOfferLines' },
      { status: 400 }
    );
  } catch (error) {
    console.error('zift GET error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Failed to execute query' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = body?.action;
  const stages: UpdateStage[] = [];

  const addStage = (step: string, message: string) => {
    stages.push({ step, message, timestamp: new Date().toISOString() });
  };

  if (action !== 'updateCouponDiscountByOid') {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Invalid action. Use updateCouponDiscountByOid for POST' },
      { status: 400 }
    );
  }

  const oid = Number(body?.oid);
  const offerNo = String(body?.offerNo || '').trim();

  addStage('validate_input', 'Started input validation');

  if (Number.isNaN(oid)) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'oid must be a number' }, { status: 400 });
  }

  if (!offerNo) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'offerNo is required' }, { status: 400 });
  }

  addStage('validate_input', 'Input validation completed');

  try {
    addStage('connect', 'Connecting to source and target databases');
    const pool1 = await getSqlPool();
    const pool2 = await getSqlPool2();
    addStage('connect', 'Connected to both databases');

    addStage('fetch_source', `Fetching WeeklyOffersList rows for Oid ${oid}`);
    const weeklyResult = await pool1.request().input('oid', sql.Int, oid).query(weeklyOffersSourceSelect);

    const sourceRows = (weeklyResult.recordset || []) as WeeklySourceRow[];
    addStage('fetch_source', `Fetched ${sourceRows.length} source rows`);

    if (sourceRows.length === 0) {
      addStage('finish', 'No source rows found, nothing to update');
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { items: 0, rowsAffected: 0, stages },
        message: 'No source rows found in WeeklyOffersList for this Oid',
      });
    }

    addStage('transaction', 'Starting SQL transaction for update');
    const transaction = new sql.Transaction(pool2);
    await transaction.begin();

    let totalRowsAffected = 0;
    let itemsUpdated = 0;
    let processedItems = 0;

    try {
      for (const row of sourceRows) {
        const itemNo = String(row.No_ || '').trim();
        const couponDiscount = Number(row.DealPerPiece ?? 0);

        if (!itemNo) {
          addStage('skip_item', 'Skipped empty item number');
          continue;
        }

        processedItems += 1;

        const updateResult = await new sql.Request(transaction)
          .input('itemNo', sql.NVarChar(50), itemNo)
          .input('offerNo', sql.NVarChar(50), offerNo)
          .input('couponDiscount', sql.Decimal(18, 4), couponDiscount)
          .query(updateCouponDiscountByItemAndOid);

        const affected = updateResult.rowsAffected?.[0] ?? 0;
        totalRowsAffected += affected;
        if (affected > 0) {
          itemsUpdated += 1;
        }

        addStage('process_item', `Item ${itemNo}: updated ${affected} rows, couponDiscount=${couponDiscount}`);
      }

      await transaction.commit();
      addStage(
        'transaction',
        `Transaction committed. Processed ${processedItems} items, affected ${totalRowsAffected} rows`
      );
    } catch (transactionError) {
      await transaction.rollback();
      addStage('transaction', 'Transaction rolled back due to error');
      throw transactionError;
    }

    addStage('finish', 'Update finished successfully');

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        oid,
        offerNo,
        sourceItems: sourceRows.length,
        itemsUpdated,
        rowsAffected: totalRowsAffected,
        stages,
      },
      message: 'Coupon Discount updated from WeeklyOffersList successfully',
    });
  } catch (error) {
    addStage('error', error instanceof Error ? error.message : 'Unknown error');
    console.error('zift coupon update error:', error);

    if (isTimeoutLikeError(error)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'The request timed out while processing database operations. Try a smaller batch or retry.',
          data: { stages },
        },
        { status: 504 }
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update Coupon Discount',
        data: { stages },
      },
      { status: 500 }
    );
  }
}