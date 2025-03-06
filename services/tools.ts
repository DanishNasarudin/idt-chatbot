import prisma from "@/lib/prisma";
import { chunkArray } from "@/lib/utils";
import { Prisma, Sales } from "@prisma/client";
import { tool } from "ai";
import { z } from "zod";
import { retrieveRelevantSalesRecords, ScoredSale } from "./sales";

const nullToUndefined = (arg: unknown) =>
  arg === "null" || arg === "None" ? null : arg;
const noneToUndefined = (val: unknown): unknown =>
  val === "None" ? null : val;

const salesAnalyticsSchema = z.object({
  operation: z
    .enum(["FILTER", "SUMMARY", "ANALYTICS", "TREND"])
    .describe(
      "Sales analytics, ONLY these options: FILTER, SUMMARY, ANALYTICS, TREND"
    ),
  startDate: z
    .preprocess(nullToUndefined, z.string().optional().nullable())
    .describe("Start date in ISO format (e.g., 2025-01-01)"),
  endDate: z
    .preprocess(nullToUndefined, z.string().optional().nullable())
    .describe("End date in ISO format (e.g., 2025-01-31)"),
  paymentMethod: z
    .preprocess(nullToUndefined, z.string().optional().nullable())
    .describe("Payment method to filter by"),
  invoice: z
    .preprocess(nullToUndefined, z.string().optional().nullable())
    .describe("Invoice substring to filter by"),
  customer: z
    .preprocess(nullToUndefined, z.string().optional().nullable())
    .describe("Customer name substring to filter by"),
  analyticsType: z
    .preprocess(
      nullToUndefined,
      z
        .enum(["TOTAL_SALES", "AVERAGE_SALES", "SALES_COUNT"])
        .optional()
        .nullable()
    )
    .describe(
      "Type of analytics to perform, ONLY these options: TOTAL_SALES, AVERAGE_SALES, SALES_COUNT"
    ),
  groupBy: z
    .enum(["DAY", "WEEK", "MONTH"])
    .optional()
    .describe(
      "Interval to group sales by, ONLY these options: DAY, WEEK, MONTH"
    ),
  limit: z
    .preprocess((arg) => {
      const val = nullToUndefined(arg);
      return typeof val === "string" ? parseInt(val, 10) : val;
    }, z.number().optional().nullable().default(0))
    .describe(
      "Optional limit for TREND aggregation (e.g., top 5 months). 0 or undefined means no limit."
    ),
  trendSortBy: z
    .preprocess(
      nullToUndefined,
      z
        .enum(["totalSales", "count"])
        .optional()
        .nullable()
        .default("totalSales")
    )
    .describe("Field to sort trends by, ONLY either 'totalSales' or 'count'"),
  trendOrder: z
    .preprocess(
      nullToUndefined,
      z.enum(["ASC", "DESC"]).optional().nullable().default("DESC")
    )
    .describe("Sort order for trends, ONLY either 'ASC' or 'DESC'"),
});

export type SalesAnalyticsParams = z.infer<typeof salesAnalyticsSchema>;

/**
 * Tool to perform analytics on sales data.
 * Performs analytics with optional filters for date range and payment method.
 * If a payment method is provided, it validates against the unique payment methods available in the database.
 */
export const getSalesAnalytics = tool({
  description:
    "Perform sales analytics: FILTER for detailed records, SUMMARY for grouped records, ANALYTICS for sales stats, and TREND for time-based trends.",
  parameters: salesAnalyticsSchema,
  execute: async (params: SalesAnalyticsParams) => {
    if (params.operation === "ANALYTICS" && !params.analyticsType) {
      throw new Error("analyticsType is required for ANALYTICS operation.");
    }
    if (params.operation === "TREND" && !params.groupBy) {
      throw new Error("groupBy is required for TREND operation.");
    }

    const buildDateFilter = (start?: string | null, end?: string | null) => {
      if (!start && !end) return undefined;
      const dateFilter: Record<string, any> = {};
      if (start) dateFilter.gte = new Date(start);
      if (end) dateFilter.lte = new Date(end);
      return dateFilter;
    };

    const filter: Record<string, any> = {};
    const dateFilter = buildDateFilter(params.startDate, params.endDate);
    if (dateFilter) filter.purchaseDate = dateFilter;

    if (params.operation === "FILTER") {
      if (params.paymentMethod) filter.paymentMethod = params.paymentMethod;
      if (params.invoice) filter.invoice = { contains: params.invoice };
      if (params.customer) {
        filter.customer = { contains: params.customer, mode: "insensitive" };
      }
      const salesData = await prisma.sales.findMany({
        where: filter,
        orderBy: { purchaseDate: "desc" },
      });
      if (salesData.length === 0)
        return "No sales records found for the given filters.";

      return salesData
        .map(
          (sale) =>
            `Invoice: ${sale.invoice}, Customer: ${
              sale.customer
            }, PurchaseDate: ${sale.purchaseDate.toISOString()}, Total: RM ${sale.total.toLocaleString(
              "en-US",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}`
        )
        .join("\n");
    } else if (params.operation === "SUMMARY") {
      const summaryData = await prisma.sales.groupBy({
        by: ["paymentMethod"],
        where: filter,
        _sum: { total: true },
        _count: { _all: true },
      });
      if (summaryData.length === 0)
        return "No sales records found for the given filters.";

      return summaryData
        .map(
          (data) =>
            `Payment Method: ${data.paymentMethod}, Count: ${
              data._count._all
            }, Total: RM ${data._sum.total?.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
        )
        .join("\n");
    } else if (params.operation === "ANALYTICS") {
      if (params.paymentMethod) {
        const methodCount = await prisma.sales.count({
          where: { ...filter, paymentMethod: params.paymentMethod },
        });
        if (methodCount === 0) {
          return `Payment method '${params.paymentMethod}' is not available.`;
        }
        filter.paymentMethod = params.paymentMethod;
      }

      if (params.analyticsType === "TOTAL_SALES") {
        const aggregateResult = await prisma.sales.aggregate({
          _sum: { total: true },
          where: filter,
        });
        const total = aggregateResult._sum.total || 0;
        return `Total sales: RM ${total.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      } else if (params.analyticsType === "AVERAGE_SALES") {
        const aggregateResult = await prisma.sales.aggregate({
          _avg: { total: true },
          where: filter,
        });
        const average = aggregateResult._avg.total || 0;
        return `Average sale: RM ${average.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      } else if (params.analyticsType === "SALES_COUNT") {
        const count = await prisma.sales.count({ where: filter });
        return `Number of sales: ${count}`;
      }
      return "Invalid analytics type provided.";
    } else if (params.operation === "TREND") {
      // Use the provided groupBy interval; default to DAY if not provided
      const interval = params.groupBy ? params.groupBy.toLowerCase() : "day";
      const conditions: string[] = [];
      const queryParams: any[] = [];
      if (params.startDate) {
        queryParams.push(new Date(params.startDate));
        conditions.push(`"purchaseDate" >= $${queryParams.length}`);
      }
      if (params.endDate) {
        queryParams.push(new Date(params.endDate));
        conditions.push(`"purchaseDate" <= $${queryParams.length}`);
      }
      const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";
      // Sort by the chosen field and order; limit if specified (non-zero)
      const sortField =
        params.trendSortBy === "totalSales"
          ? "total"
          : params.trendSortBy || "total";
      const sortOrder = params.trendOrder || "DESC";
      const limitClause =
        params.limit && params.limit > 0 ? `LIMIT ${params.limit}` : "";
      const query = `
        SELECT date_trunc('${interval}', "purchaseDate") as period,
               SUM(total) as "total",
               COUNT(*) as "count"
        FROM "Sales"
        ${whereClause}
        GROUP BY period
        ORDER BY ${sortField} ${sortOrder}
        ${limitClause};
      `;
      type Trend = { period: Date; total: number; count: number };
      const trends: Trend[] = await prisma.$queryRawUnsafe(
        query,
        ...queryParams
      );

      return trends
        .map((trend) => {
          const trendDate = new Date(trend.period);
          let periodStr = "";
          if (params.groupBy === "DAY") {
            periodStr = trendDate.toISOString().split("T")[0];
          } else if (params.groupBy === "WEEK") {
            const year = trendDate.getFullYear();
            const firstDay = new Date(year, 0, 1);
            const week = Math.ceil(
              ((trendDate.getTime() - firstDay.getTime()) / 86400000 +
                firstDay.getDay() +
                1) /
                7
            );
            periodStr = `${year}-W${week}`;
          } else if (params.groupBy === "MONTH") {
            periodStr = `${trendDate.getFullYear()}-${(trendDate.getMonth() + 1)
              .toString()
              .padStart(2, "0")}`;
          } else {
            periodStr = trendDate.toISOString();
          }
          return `Period: ${periodStr}, Total Sales: RM ${trend.total.toLocaleString(
            "en-US",
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
          )}, Sales Count: ${trend.count}`;
        })
        .join("\n");
    }
    return "Invalid operation.";
  },
});

/**
 * Tool to retrieve sales records using flexible filters.
 * Supports filtering by date range, payment method, invoice substring, and customer name substring.
 */
// export const getSalesFiltered = tool({
//   description:
//     "Retrieve sales records based on filters such as date range, payment method, invoice, or customer name.",
//   parameters: z.object({
//     startDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("Start date in ISO format (e.g., 2025-01-01)"),
//     endDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("End date in ISO format (e.g., 2025-01-31)"),
//     paymentMethod: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("Payment method to filter by"),
//     invoice: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("Invoice substring to filter by"),
//     customer: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("Customer name substring to filter by"),
//   }),
//   execute: async ({ startDate, endDate, paymentMethod, invoice, customer }) => {
//     const filter: Record<string, any> = {};
//     if (startDate || endDate) {
//       filter.purchaseDate = {};
//       if (startDate) filter.purchaseDate.gte = new Date(startDate);
//       if (endDate) filter.purchaseDate.lte = new Date(endDate);
//     }
//     if (paymentMethod) {
//       filter.paymentMethod = paymentMethod;
//     }
//     if (invoice) {
//       filter.invoice = { contains: invoice };
//     }
//     if (customer) {
//       filter.customer = { contains: customer, mode: "insensitive" };
//     }

//     const salesData = await prisma.sales.findMany({
//       where: filter,
//       orderBy: { purchaseDate: "desc" },
//     });

//     if (salesData.length === 0) {
//       return "No sales records found for the given filters.";
//     }

//     const formatted = salesData
//       .map(
//         (sale) =>
//           `Invoice: ${sale.invoice}, Customer: ${
//             sale.customer
//           }, PurchaseDate: ${sale.purchaseDate.toISOString()}, Total: ${
//             sale.total
//           }`
//       )
//       .join("\n");

//     return formatted;
//   },
// });

// /**
//  * Tool to get a summary of sales grouped by payment method.
//  * Optionally accepts a date range filter.
//  */
// export const getSalesSummary = tool({
//   description:
//     "Get a summary of sales aggregated by payment method within an optional date range.",
//   parameters: z.object({
//     startDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("Start date in ISO format (e.g., 2025-01-01)"),
//     endDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("End date in ISO format (e.g., 2025-01-31)"),
//   }),
//   execute: async ({ startDate, endDate }) => {
//     const filter: Record<string, any> = {};
//     if (startDate || endDate) {
//       filter.purchaseDate = {};
//       if (startDate) filter.purchaseDate.gte = new Date(startDate);
//       if (endDate) filter.purchaseDate.lte = new Date(endDate);
//     }

//     const salesData = await prisma.sales.findMany({ where: filter });

//     if (salesData.length === 0) {
//       return "No sales records found for the given filters.";
//     }

//     // Group sales by payment method.
//     const summary = salesData.reduce(
//       (acc: Record<string, { count: number; total: number }>, sale) => {
//         const key = sale.paymentMethod;
//         if (!acc[key]) {
//           acc[key] = { count: 0, total: 0 };
//         }
//         acc[key].count += 1;
//         acc[key].total += sale.total;
//         return acc;
//       },
//       {}
//     );

//     const result = Object.entries(summary)
//       .map(
//         ([method, data]) =>
//           `Payment Method: ${method}, Count: ${
//             data.count
//           }, Total: RM ${data.total.toLocaleString("en-US", {
//             minimumFractionDigits: 2,
//             maximumFractionDigits: 2,
//           })}`
//       )
//       .join("\n");

//     return result;
//   },
// });

/**
 * Tool to get information from the database using RAG.
 */
// export const getInformation = tool({
//   description: `Get information from your knowledge sales database to answer questions ONLY when semantic search is required, RAG.`,
//   parameters: z.object({
//     query: z
//       .string()
//       .describe("interpreted user request from full chat context"),
//   }),
//   execute: async ({ query }) => await retrieveRelevantSales(query),
// });

/**
 * Tool to analyze sales trends over time.
 * Groups sales by day, week, or month and returns total sales and count.
 */
// export const getSalesTrend = tool({
//   description:
//     "Analyze sales trends over time grouped by day, week, or month. Returns aggregated total sales and count per period.",
//   parameters: z.object({
//     startDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("Start date in ISO format (e.g., 2025-01-01)"),
//     endDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("End date in ISO format (e.g., 2025-01-31)"),
//     groupBy: z
//       .enum(["DAY", "WEEK", "MONTH"])
//       .describe("Interval to group sales by"),
//   }),
//   execute: async ({ startDate, endDate, groupBy }) => {
//     const conditions: string[] = [];
//     const params: any[] = [];
//     if (startDate) {
//       conditions.push(`"purchaseDate" >= $${params.length + 1}`);
//       params.push(new Date(startDate));
//     }
//     if (endDate) {
//       conditions.push(`"purchaseDate" <= $${params.length + 1}`);
//       params.push(new Date(endDate));
//     }
//     const whereClause = conditions.length
//       ? `WHERE ${conditions.join(" AND ")}`
//       : "";

//     const interval = groupBy.toLowerCase(); // 'day', 'week', or 'month'

//     const query = `
//       SELECT date_trunc('${interval}', "purchaseDate") as period,
//              SUM(total) as "totalSales",
//              COUNT(*) as "count"
//       FROM "Sales"
//       ${whereClause}
//       GROUP BY period
//       ORDER BY period;
//     `;
//     type Trend = { period: Date; totalSales: number; count: number };
//     const trends: Trend[] = await prisma.$queryRawUnsafe(query, ...params);

//     return trends
//       .map((trend) => {
//         const trendDate = new Date(trend.period);
//         const periodStr =
//           groupBy === "DAY"
//             ? trendDate.toISOString().split("T")[0]
//             : groupBy === "WEEK"
//             ? (() => {
//                 const year = trendDate.getFullYear();
//                 const firstDay = new Date(year, 0, 1);
//                 const week = Math.ceil(
//                   ((trendDate.getTime() - firstDay.getTime()) / 86400000 +
//                     firstDay.getDay() +
//                     1) /
//                     7
//                 );
//                 return `${year}-W${week}`;
//               })()
//             : `${trendDate.getFullYear()}-${(trendDate.getMonth() + 1)
//                 .toString()
//                 .padStart(2, "0")}`;
//         return `Period: ${periodStr}, Total Sales: RM ${trend.totalSales.toLocaleString(
//           "en-US",
//           {
//             minimumFractionDigits: 2,
//             maximumFractionDigits: 2,
//           }
//         )}, Sales Count: ${trend.count}`;
//       })
//       .join("\n");
//   },
// });

/**
 * Tool to retrieve the top customers based on total sales.
 * Optionally filters by a date range and returns a limited list.
 */
// export const getTopCustomers = tool({
//   description:
//     "Retrieve top customers based on total sales amount within an optional date range.",
//   parameters: z.object({
//     startDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("Start date in ISO format (e.g., 2025-01-01)"),
//     endDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("End date in ISO format (e.g., 2025-01-31)"),
//     limit: z
//       .preprocess((arg) => {
//         const val = nullToUndefined(arg);
//         return typeof val === "string" ? parseFloat(val) : val;
//       }, z.number().optional().nullable().default(5))
//       .describe("Maximum number of customers to return"),
//   }),
//   execute: async ({ startDate, endDate, limit = 5 }) => {
//     const filter: Record<string, any> = {};
//     if (startDate || endDate) {
//       filter.purchaseDate = {};
//       if (startDate) filter.purchaseDate.gte = new Date(startDate);
//       if (endDate) filter.purchaseDate.lte = new Date(endDate);
//     }
//     const salesData = await prisma.sales.findMany({ where: filter });

//     const customerTotals: Record<string, number> = {};
//     salesData.forEach((sale) => {
//       if (!customerTotals[sale.customer]) {
//         customerTotals[sale.customer] = 0;
//       }
//       customerTotals[sale.customer] += sale.total;
//     });

//     const topCustomers = Object.entries(customerTotals)
//       .sort(([, totalA], [, totalB]) => totalB - totalA)
//       .slice(0, limit || 5)
//       .map(
//         ([customer, total]) =>
//           `Customer: ${customer}, Total Sales: RM ${total.toLocaleString(
//             "en-US",
//             {
//               minimumFractionDigits: 2,
//               maximumFractionDigits: 2,
//             }
//           )}`
//       )
//       .join("\n");

//     return topCustomers || "No sales records found for the given filters.";
//   },
// });

/**
 * Tool to analyze sales per item.
 * Aggregates total quantity sold, total sales, and average price per item.
 */
// export const getItemSalesAnalysis = tool({
//   description:
//     "Provide analysis PER item (Not null) including total quantity sold, total sales amount, and average sale price.",
//   parameters: z.object({
//     startDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("Start date in ISO format (e.g., 2025-01-01)"),
//     endDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("End date in ISO format (e.g., 2025-01-31)"),
//     item: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("Item substring to filter by"),
//   }),
//   execute: async ({ startDate, endDate, item }) => {
//     const filter: Record<string, any> = {};
//     if (startDate || endDate) {
//       filter.purchaseDate = {};
//       if (startDate) filter.purchaseDate.gte = new Date(startDate);
//       if (endDate) filter.purchaseDate.lte = new Date(endDate);
//     }
//     if (item) {
//       filter.item = { contains: item, mode: "insensitive" };
//     }
//     const salesData = await prisma.sales.findMany({ where: filter });

//     if (salesData.length === 0) {
//       return "No sales records found for the given filters.";
//     }

//     const itemStats: Record<
//       string,
//       { totalQuantity: number; totalSales: number; totalPrice: number }
//     > = {};

//     salesData.forEach((sale) => {
//       const key = sale.item;
//       if (!itemStats[key]) {
//         itemStats[key] = { totalQuantity: 0, totalSales: 0, totalPrice: 0 };
//       }
//       itemStats[key].totalQuantity += sale.quantity;
//       itemStats[key].totalSales += sale.total;
//       // Calculate total price by multiplying price and quantity
//       itemStats[key].totalPrice += sale.price * sale.quantity;
//     });

//     const result = Object.entries(itemStats)
//       .map(([itemName, data]) => {
//         const averagePrice =
//           data.totalQuantity > 0 ? data.totalPrice / data.totalQuantity : 0;
//         return `Item: ${itemName}, Total Quantity Sold: ${
//           data.totalQuantity
//         }, Total Sales: RM ${data.totalSales.toFixed(
//           2
//         )}, Average Price: RM ${averagePrice.toLocaleString("en-US", {
//           minimumFractionDigits: 2,
//           maximumFractionDigits: 2,
//         })}`;
//       })
//       .join("\n");

//     return result;
//   },
// });

/**
 * Tool to list the unique payment methods available in the sales dataset.
 */
// export const listPaymentMethods = tool({
//   description:
//     "Retrieve the list of unique payment methods available in the sales dataset.",
//   parameters: z.object({}),
//   execute: async () => {
//     const paymentMethods = await prisma.sales.findMany({
//       select: { paymentMethod: true },
//       distinct: ["paymentMethod"],
//     });
//     const methods = paymentMethods.map((pm) => pm.paymentMethod);
//     return methods.length
//       ? `Available payment methods: ${methods.join(", ")}`
//       : "No payment methods found.";
//   },
// });

/**
 * Tool to analyze sales by region or state.
 * Extracts the region (assumed to be the last segment of the customer address if comma-separated),
 * then aggregates sales data per region.
 */
// export const getSalesByRegion = tool({
//   description:
//     "Analyze sales trends by region or state. Uses the full customer address to aggregate sales data. The full address is provided for downstream interpretation of region details.",
//   parameters: z.object({
//     startDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("Start date in ISO format (e.g., 2025-01-01)"),
//     endDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("End date in ISO format (e.g., 2025-01-31)"),
//   }),
//   execute: async ({ startDate, endDate }) => {
//     const filter: Record<string, any> = {};
//     if (startDate || endDate) {
//       filter.purchaseDate = {};
//       if (startDate) filter.purchaseDate.gte = new Date(startDate);
//       if (endDate) filter.purchaseDate.lte = new Date(endDate);
//     }
//     const salesData = await prisma.sales.findMany({ where: filter });
//     if (salesData.length === 0) {
//       return "No sales records found for the given filters.";
//     }
//     // Group sales by full address.
//     const summary = salesData.reduce(
//       (acc: Record<string, { count: number; total: number }>, sale) => {
//         const key = sale.address;
//         if (!acc[key]) {
//           acc[key] = { count: 0, total: 0 };
//         }
//         acc[key].count += 1;
//         acc[key].total += sale.total;
//         return acc;
//       },
//       {}
//     );
//     const result = Object.entries(summary)
//       .map(
//         ([address, data]) =>
//           `Address: ${address}, Count: ${
//             data.count
//           }, Total: RM ${data.total.toLocaleString("en-US", {
//             minimumFractionDigits: 2,
//             maximumFractionDigits: 2,
//           })}`
//       )
//       .join("\n");
//     return result;
//   },
// });

/**
 * Tool to list down the top-selling (hot) items within a specific region.
 * Items are ranked by either quantity sold or total sales amount.
 */
// export const getHotItemsByRegion = tool({
//   description:
//     "List top-selling items within a specific region or state filter. Filters sales by checking if the full address includes the provided region substring, and returns items ranked by quantity or total sales.",
//   parameters: z.object({
//     region: z
//       .string()
//       .describe("Region or state to filter sales by (e.g., Johor)"),
//     startDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("Start date in ISO format (e.g., 2025-01-01)"),
//     endDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("End date in ISO format (e.g., 2025-01-31)"),
//     sortBy: z
//       .preprocess(
//         nullToUndefined,
//         z
//           .enum(["QUANTITY", "TOTAL_SALES"])
//           .optional()
//           .nullable()
//           .default("QUANTITY")
//       )
//       .describe("Sort items by quantity sold or total sales amount"),
//     limit: z
//       .preprocess((arg) => {
//         const val = nullToUndefined(arg);
//         return typeof val === "string" ? parseFloat(val) : val;
//       }, z.number().optional().nullable().default(5))
//       .describe("Maximum number of items to return"),
//   }),
//   execute: async ({ region, startDate, endDate, sortBy, limit }) => {
//     const filter: Record<string, any> = {};
//     if (startDate || endDate) {
//       filter.purchaseDate = {};
//       if (startDate) filter.purchaseDate.gte = new Date(startDate);
//       if (endDate) filter.purchaseDate.lte = new Date(endDate);
//     }
//     const salesData = await prisma.sales.findMany({ where: filter });
//     // Use full address and check if it includes the provided substring.
//     const regionFiltered = salesData.filter((sale) =>
//       sale.address.toLowerCase().includes(region.toLowerCase())
//     );
//     // Group sales by item.
//     const itemMap: Record<
//       string,
//       { totalQuantity: number; totalSales: number }
//     > = {};
//     regionFiltered.forEach((sale) => {
//       const key = sale.item;
//       if (!itemMap[key]) {
//         itemMap[key] = { totalQuantity: 0, totalSales: 0 };
//       }
//       itemMap[key].totalQuantity += sale.quantity;
//       itemMap[key].totalSales += sale.total;
//     });
//     let items = Object.entries(itemMap).map(([item, stats]) => ({
//       item,
//       ...stats,
//     }));
//     if (sortBy === "TOTAL_SALES") {
//       items = items.sort((a, b) => b.totalSales - a.totalSales);
//     } else {
//       items = items.sort((a, b) => b.totalQuantity - a.totalQuantity);
//     }
//     const topItems = items.slice(0, limit || 5);
//     if (topItems.length === 0)
//       return "No hot items found for the given region and filters.";
//     return topItems
//       .map(
//         (item) =>
//           `Item: ${item.item}, Quantity Sold: ${
//             item.totalQuantity
//           }, Total Sales: RM ${item.totalSales.toLocaleString("en-US", {
//             minimumFractionDigits: 2,
//             maximumFractionDigits: 2,
//           })}`
//       )
//       .join("\n");
//   },
// });

// /**
//  * Tool to aggregate invoice trends by region.
//  * When a region is provided, returns the unique invoice count, total invoice amount, and average invoice value for that region.
//  * Otherwise, groups results by region.
//  */
// export const getSalesAndInvoiceTrendsByRegion = tool({
//   description:
//     "Analyze sales and invoice trends by region or state. Aggregates sales data and invoice metrics based on optional region and date filters.",
//   parameters: z.object({
//     region: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("Optional region to filter by (e.g., Johor)"),
//     startDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("Start date in ISO format (e.g., 2025-01-01)"),
//     endDate: z
//       .preprocess(nullToUndefined, z.string().optional().nullable())
//       .describe("End date in ISO format (e.g., 2025-01-31)"),
//   }),
//   execute: async ({ region, startDate, endDate }) => {
//     const filter: Record<string, any> = {};
//     if (startDate || endDate) {
//       filter.purchaseDate = {};
//       if (startDate) filter.purchaseDate.gte = new Date(startDate);
//       if (endDate) filter.purchaseDate.lte = new Date(endDate);
//     }

//     const salesData = await prisma.sales.findMany({
//       where: {
//         ...filter,
//         ...(region && { address: { contains: region } }),
//       },
//     });

//     if (salesData.length === 0) {
//       return "No sales records found for the given filters.";
//     }

//     // Group sales by full address.
//     const summary = salesData.reduce(
//       (acc: Record<string, { count: number; total: number }>, sale) => {
//         const key = sale.address;
//         if (!acc[key]) {
//           acc[key] = { count: 0, total: 0 };
//         }
//         acc[key].count += 1;
//         acc[key].total += sale.total;
//         return acc;
//       },
//       {}
//     );

//     const salesResult = Object.entries(summary)
//       .map(
//         ([address, data]) =>
//           `Address: ${address}, Sales Count: ${
//             data.count
//           }, Sales Total: RM ${data.total.toLocaleString("en-US", {
//             minimumFractionDigits: 2,
//             maximumFractionDigits: 2,
//           })}`
//       )
//       .join("\n");

//     const invoiceGroups = await prisma.sales.groupBy({
//       by: ["invoice"],
//       where: {
//         ...filter,
//         ...(region && { address: { contains: region } }),
//       },
//       _sum: { total: true },
//     });

//     const invoiceCount = invoiceGroups.length;
//     const totalInvoiceAmount = invoiceGroups.reduce(
//       (acc, group) => acc + (group._sum.total || 0),
//       0
//     );
//     const averageInvoiceValue =
//       invoiceCount > 0 ? totalInvoiceAmount / invoiceCount : 0;

//     return (
//       (region ? `Region Filter: ${region}\n` : "") +
//       salesResult +
//       `\nUnique Invoices: ${invoiceCount}\n` +
//       `Total Invoice Amount: RM ${totalInvoiceAmount.toFixed(2)}\n` +
//       `Average Invoice Value: RM ${averageInvoiceValue.toLocaleString("en-US", {
//         minimumFractionDigits: 2,
//         maximumFractionDigits: 2,
//       })}`
//     );
//   },
// });

/**
 * Tool to retrieve detailed information for a specific invoice.
 * Lists every item tied to the invoice and calculates the overall invoice total.
 */
export const getInvoiceDetails = tool({
  description:
    "Retrieve detailed information for a given invoice, listing every item tied to that invoice and summing up the overall invoice total.",
  parameters: z.object({
    invoice: z
      .string()
      .describe("The invoice number to retrieve details for (e.g., J0125013)"),
  }),
  execute: async ({ invoice }) => {
    const invoiceData = await prisma.sales.findMany({
      where: { invoice },
    });

    if (invoiceData.length === 0) {
      return `No records found for invoice ${invoice}.`;
    }

    const details = invoiceData
      .map(
        (sale) =>
          `Customer: ${
            sale.customer
          }, PurchaseDate: ${sale.purchaseDate.toISOString()}, Address: ${
            sale.address
          }, Item: ${sale.item}, Quantity: ${
            sale.quantity
          }, Price: RM ${sale.price.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}, Total: RM ${sale.total.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}, Payment: ${sale.paymentMethod}`
      )
      .join("\n");

    const totalInvoiceAmount = invoiceData.reduce(
      (acc, sale) => acc + sale.total,
      0
    );

    return `Invoice: ${invoice}\n${details}\nOverall Invoice Total: RM ${totalInvoiceAmount.toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  },
});

/**
 * Tool to retrieve the unique regions from the sales dataset.
 * Extracts the region from the 'address' field by taking the last segment after a comma.
 */
// export const listRegions = tool({
//   description:
//     "Retrieve the list of full addresses available in the sales dataset. Use these addresses to infer region or state details.",
//   parameters: z.object({}),
//   execute: async () => {
//     const salesData = await prisma.sales.findMany({
//       select: { address: true },
//     });
//     const addressesSet = new Set<string>();
//     salesData.forEach((sale) => {
//       addressesSet.add(sale.address);
//     });
//     const addresses = Array.from(addressesSet);
//     return addresses.length
//       ? `Available addresses: ${addresses.join(", ")}`
//       : "No addresses found in the dataset.";
//   },
// });

const preprocessSortBy = (value: unknown) => {
  const processed = nullToUndefined(value);
  if (typeof processed === "string") {
    const lower = processed.toLowerCase().trim();
    if (lower === "total sales") return "TOTAL_SALES";
    if (lower === "count") return "COUNT";
    if (lower === "quantity") return "QUANTITY";
  }
  return processed;
};

/**
 * Retrieve top aggregates based on a flexible grouping.
 * For ITEM grouping, perform per-item analysis including average sale price;
 * for other groups, return count, total sales, and total quantity.
 * Optionally filter by time period and region.
 * When a region is provided, invoice trends for that region are appended.
 */
export const getTopAggregates = tool({
  description:
    "Retrieve top aggregates based on a flexible grouping (ITEM, STATE, CUSTOMER, INVOICE, PAYMENT_METHOD). For ITEM grouping, perform per-item analysis including average sale price; for other groups, return COUNT, TOTAL_SALES, and QUANTITY. Optionally filter by time period, region (from address), item description, customer, invoice, and payment method. When a region is provided, invoice trends for that region are appended.",
  parameters: z.object({
    groupBy: z
      .enum(["ITEM", "STATE", "CUSTOMER", "INVOICE", "PAYMENT_METHOD"])
      .describe(
        "Field to group by, ONLY these options: ITEM, STATE, CUSTOMER, INVOICE, PAYMENT_METHOD"
      ),
    sortBy: z
      .preprocess(
        preprocessSortBy,
        z
          .enum(["TOTAL_SALES", "COUNT", "QUANTITY"])
          .optional()
          .nullable()
          .default("TOTAL_SALES")
      )
      .describe(
        "Criteria to sort the groups, ONLY these options: TOTAL_SALES, COUNT, QUANTITY"
      ),
    startDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Start date in ISO format (e.g., 2025-01-01)"),
    endDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("End date in ISO format (e.g., 2025-01-31)"),
    limit: z
      .preprocess((arg) => {
        const val = nullToUndefined(arg);
        return typeof val === "string" ? parseFloat(val) : val;
      }, z.number().optional().nullable().default(5))
      .describe(
        "Maximum number of groups to return. Increase number if filter is not in range."
      ),
    region: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Optionally filter the region (e.g., Johor)"),
    item: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe(
        "Optionally filter the item (e.g., RTX4060, Intel 14400F), one item at one time"
      ),
    customer: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Optionally filter the customer (e.g., John Doe)"),
    invoice: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Optionally filter the invoice (e.g., FE435-24, J0724012)"),
    paymentMethod: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Optionally filter the payment method (e.g., Credit Card)"),
  }),
  execute: async ({
    groupBy,
    sortBy,
    startDate,
    endDate,
    limit = 5,
    region,
    item,
    customer,
    invoice,
    paymentMethod,
  }) => {
    const buildStringFilter = (value?: string | null) =>
      value ? { contains: value, mode: "insensitive" } : undefined;
    // Build a filter with date and optional region (applied using case-insensitive substring match)
    const filter: Record<string, any> = {};
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.gte = new Date(startDate);
      if (endDate) filter.purchaseDate.lte = new Date(endDate);
    }
    if (region) {
      filter.address = buildStringFilter(region);
    }
    // if (item) {
    //   filter.item = buildStringFilter(item);
    // }
    if (customer) {
      filter.customer = buildStringFilter(customer);
    }
    if (invoice) {
      filter.invoice = buildStringFilter(invoice);
    }
    if (paymentMethod) {
      filter.paymentMethod = buildStringFilter(paymentMethod);
    }

    // const limitSanitise =
    //   startDate ||
    //   endDate ||
    //   region ||
    //   item ||
    //   customer ||
    //   invoice ||
    //   paymentMethod
    //     ? null
    //     : limit;
    const limitSanitise = limit;

    const MAX_SALES_LIMIT = 1000;
    const MAX_BATCH_SIZE = 30000;

    let result = "";
    let scoredIds: string[] = [];
    if (groupBy === "ITEM") {
      // For ITEM grouping, use manual aggregation.
      // Select only required fields to optimize performance.
      if (item) {
        const scoredSales: ScoredSale[] = await retrieveRelevantSalesRecords(
          item
        );
        if (scoredSales.length === 0)
          return "No sales records found for the given filters.";
        scoredIds = scoredSales.map((sale) => sale.id);
        filter.id = { in: scoredIds };
        filter.item = buildStringFilter(item);
      }

      let salesData: Partial<Sales>[] = [];

      try {
        console.log(filter[0].length, "DOUBLE CHECK");
        salesData = await prisma.sales.findMany({
          where: filter,
          select: { item: true, quantity: true, total: true, price: true },
        });
      } catch {
        const batches = chunkArray(scoredIds, MAX_BATCH_SIZE);
        for (const batch of batches) {
          const partialData = await prisma.sales.findMany({
            where: { ...filter, id: { in: batch } },
            select: { item: true, quantity: true, total: true, price: true },
          });
          salesData = salesData.concat(partialData);
        }
      }

      if (salesData.length === 0) {
        salesData = await prisma.sales.findMany({
          where: {
            id: {
              in: scoredIds,
            },
          },
          select: { item: true, quantity: true, total: true, price: true },
          take: 1000,
        });
      }
      if (salesData.length === 0)
        return "No sales records found for the given filters.";

      const itemStats: Record<
        string,
        {
          count: number;
          totalQuantity: number;
          totalSales: number;
          totalPrice: number;
        }
      > = {};

      salesData.forEach((sale) => {
        const key = sale.item;
        if (!itemStats[key!]) {
          itemStats[key!] = {
            count: 0,
            totalQuantity: 0,
            totalSales: 0,
            totalPrice: 0,
          };
        }
        itemStats[key!].count += 1;
        itemStats[key!].totalQuantity += sale.quantity!;
        itemStats[key!].totalSales += sale.total!;
        itemStats[key!].totalPrice += sale.price! * sale.quantity!;
      });

      let aggregatedItems = Object.entries(itemStats).map(
        ([itemName, data]) => {
          const averagePrice =
            data.totalQuantity > 0 ? data.totalPrice / data.totalQuantity : 0;
          return {
            group: itemName,
            count: data.count,
            totalQuantity: data.totalQuantity,
            totalSales: data.totalSales,
            averagePrice,
          };
        }
      );

      if (sortBy === "COUNT") {
        aggregatedItems.sort((a, b) => b.count - a.count);
      } else if (sortBy === "QUANTITY") {
        aggregatedItems.sort((a, b) => b.totalQuantity - a.totalQuantity);
      } else {
        aggregatedItems.sort((a, b) => b.totalSales - a.totalSales);
      }

      aggregatedItems = aggregatedItems.slice(0, limitSanitise || undefined);
      result = aggregatedItems
        .map(
          (item) =>
            `Item: ${item.group}, Count: ${item.count}, Total Quantity Sold: ${
              item.totalQuantity
            }, Total Sales: RM ${item.totalSales.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}, Average Price: RM ${item.averagePrice.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
        )
        .join("\n");
    } else {
      // For non-ITEM groupings, use Prisma's groupBy.
      const fieldMapping: Record<
        Exclude<typeof groupBy, "ITEM">,
        Prisma.SalesScalarFieldEnum
      > = {
        STATE: "address",
        CUSTOMER: "customer",
        INVOICE: "invoice",
        PAYMENT_METHOD: "paymentMethod",
      };
      const groupField: Prisma.SalesScalarFieldEnum =
        fieldMapping[groupBy as Exclude<typeof groupBy, "ITEM">];

      const groups = await prisma.sales.groupBy({
        by: [groupField],
        where: filter,
        _count: { _all: true },
        _sum: { total: true, quantity: true },
      });

      const sortedGroups = groups.sort((a, b) => {
        if (sortBy === "COUNT") {
          return b._count._all - a._count._all;
        } else if (sortBy === "QUANTITY") {
          return (b._sum.quantity || 0) - (a._sum.quantity || 0);
        } else {
          return (b._sum.total || 0) - (a._sum.total || 0);
        }
      });

      const topGroups = sortedGroups.slice(0, limitSanitise || undefined);
      if (topGroups.length === 0)
        return "No groups found for the given filters.";

      result = topGroups
        .map((groupData) => {
          const key = groupData[groupField];
          return `Group (${groupBy}): ${key}, Count: ${
            groupData._count._all
          }, Total Sales: RM ${groupData._sum.total?.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}, Total Quantity: ${groupData._sum.quantity}`;
        })
        .join("\n");
    }

    // If region is provided, append invoice trends (aggregated by invoice) for that region.
    if (region) {
      const invoiceGroups = await prisma.sales.groupBy({
        by: ["invoice"],
        where: filter,
        _sum: { total: true },
      });
      const invoiceCount = invoiceGroups.length;
      const totalInvoiceAmount = invoiceGroups.reduce(
        (acc, group) => acc + (group._sum.total || 0),
        0
      );
      const averageInvoiceValue =
        invoiceCount > 0 ? totalInvoiceAmount / invoiceCount : 0;
      const invoiceSummary = [
        `Invoice Trends:`,
        `Unique Invoices: ${invoiceCount}`,
        `Total Invoice Amount: RM ${totalInvoiceAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        `Average Invoice Value: RM ${averageInvoiceValue.toLocaleString(
          "en-US",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}`,
      ].join("\n");
      result = `${result}\n\n${invoiceSummary}`;
    }
    return result;
  },
});

export const getSalesMetadata = tool({
  description:
    "Retrieve metadata from the sales dataset. Query types: 'paymentMethods', 'regions', or 'dateRange'.",
  parameters: z.object({
    queryType: z.enum(["paymentMethods", "regions", "dateRange"]),
  }),
  execute: async ({ queryType }) => {
    if (queryType === "paymentMethods") {
      const results = await prisma.sales.findMany({
        select: { paymentMethod: true },
        distinct: ["paymentMethod"],
      });
      const methods = results.map((r) => r.paymentMethod);
      return methods.length
        ? `Available payment methods: ${methods.join(", ")}`
        : "No payment methods found.";
    }

    if (queryType === "regions") {
      const results = await prisma.sales.findMany({
        select: { address: true },
        distinct: ["address"],
      });
      const regions = results.map((r) => r.address);
      return regions.length
        ? `Available regions: ${regions.join(", ")}`
        : "No regions found.";
    }

    if (queryType === "dateRange") {
      const result = await prisma.sales.aggregate({
        _min: { purchaseDate: true },
        _max: { purchaseDate: true },
      });
      if (!result._min.purchaseDate || !result._max.purchaseDate) {
        return "No date range found.";
      }
      return `Date range: From ${result._min.purchaseDate.toISOString()} to ${result._max.purchaseDate.toISOString()}`;
    }

    return "Unsupported query type.";
  },
});

export const testSearchAggregates = tool({
  description:
    "Test search query based on provided filters. Returns the count of matching records and a sample of records. Confirm with the user if the results meet expectations before proceeding with full aggregation.",
  parameters: z.object({
    startDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Start date in ISO format (e.g., 2025-01-01)"),
    endDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("End date in ISO format (e.g., 2025-01-31)"),
    region: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Optional region filter (e.g., Johor)"),
    item: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Optional item filter (e.g., RTX 40 series)"),
    customer: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Optional customer filter (e.g., John Doe)"),
    invoice: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Optional invoice filter (e.g., FE435-24, J0724012)"),
    paymentMethod: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Optional payment method filter (e.g., Credit Card)"),
  }),
  execute: async ({
    startDate,
    endDate,
    region,
    item,
    customer,
    invoice,
    paymentMethod,
  }) => {
    function buildFuzzyClause(
      field: string,
      value?: string | null
    ): Record<string, any> | null {
      if (!value) return null;
      const tokens = value.split(/\s+/).filter((token) => token.length > 0);
      if (!tokens.length) return null;
      return {
        OR: tokens.map((token) => ({
          [field]: { contains: token },
        })),
      };
    }

    const filters: any[] = [];
    if (startDate || endDate) {
      const dateFilter: Record<string, any> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      filters.push({ purchaseDate: dateFilter });
    }
    const regionFilter = buildFuzzyClause("address", region);
    if (regionFilter) filters.push(regionFilter);
    const itemFilter = buildFuzzyClause("item", item);
    if (itemFilter) filters.push(itemFilter);
    const customerFilter = buildFuzzyClause("customer", customer);
    if (customerFilter) filters.push(customerFilter);
    const paymentMethodFilter = buildFuzzyClause(
      "paymentMethod",
      paymentMethod
    );
    if (paymentMethodFilter) filters.push(paymentMethodFilter);
    if (invoice) {
      filters.push({ invoice: { contains: invoice } });
    }
    const filter = filters.length > 0 ? { AND: filters } : {};

    const count = await prisma.sales.count({ where: filter });
    const sample = await prisma.sales.findMany({
      where: filter,
      take: 3,
      select: {
        id: true,
        item: true,
        customer: true,
        invoice: true,
        purchaseDate: true,
      },
    });
    return `Test Search Result:
Found ${count} matching record(s).
Sample Records:
${sample
  .map(
    (rec) =>
      `ID: ${rec.id}, Item: ${rec.item}, Customer: ${rec.customer}, Invoice: ${
        rec.invoice
      }, Date: ${rec.purchaseDate.toISOString()}`
  )
  .join("\n")}
Please confirm if these results meet your expectations before proceeding with full aggregation.`;
  },
});

type ToolsMapping<T = any> = Record<string, T>;

function addUnderscoreAliases<T extends Record<string, any>>(
  tools: T
): T & ToolsMapping<T[keyof T]> {
  const updatedTools = { ...tools } as Record<string, T[keyof T]>;
  for (const key in tools) {
    const underscoreKey = key;
    if (!(underscoreKey in updatedTools)) {
      (updatedTools as any)[underscoreKey] = tools[key];
    }
  }
  return updatedTools as T & ToolsMapping<T[keyof T]>;
}

const baseTools = {
  getSalesAnalytics,
  // getSalesFiltered,
  // getSalesSummary,
  // getInformation,
  // getSalesTrend,
  // getTopCustomers,
  // getItemSalesAnalysis,
  // listPaymentMethods,
  // getSalesByRegion,
  // getHotItemsByRegion,
  // getSalesAndInvoiceTrendsByRegion,
  getInvoiceDetails,
  // listRegions,
  getTopAggregates,
  getSalesMetadata,
  // testSearchAggregates,
};

export const toolsMapping = addUnderscoreAliases(baseTools);
