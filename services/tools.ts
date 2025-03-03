import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";
import { retrieveRelevantSales } from "./sales";

const nullToUndefined = (arg: unknown) => (arg === "null" ? null : arg);

/**
 * Tool to perform analytics on sales data.
 * Performs analytics with optional filters for date range and payment method.
 * If a payment method is provided, it validates against the unique payment methods available in the database.
 */
export const getSalesAnalytics = tool({
  description:
    "Perform sales analytics with optional filters for date range and payment method. If a payment method is provided, it is validated against available payment methods in the database.",
  parameters: z.object({
    startDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Start date in ISO format (e.g., 2025-01-01)"),
    endDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("End date in ISO format (e.g., 2025-01-31)"),
    paymentMethod: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe(
        "Payment method to filter by (must match one of the available methods)"
      ),
    analyticsType: z
      .enum(["TOTAL_SALES", "AVERAGE_SALES", "SALES_COUNT"])
      .describe("Type of analytics to perform"),
  }),
  execute: async ({ startDate, endDate, paymentMethod, analyticsType }) => {
    const filter: Record<string, any> = {};

    // Validate payment method if provided.
    if (paymentMethod) {
      const availableMethods = await prisma.sales.findMany({
        select: { paymentMethod: true },
        distinct: ["paymentMethod"],
      });
      const methodList = availableMethods.map((pm) => pm.paymentMethod);
      if (!methodList.includes(paymentMethod)) {
        return `Payment method '${paymentMethod}' is not available. Available payment methods: ${methodList.join(
          ", "
        )}`;
      }
      filter.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.gte = new Date(startDate);
      if (endDate) filter.purchaseDate.lte = new Date(endDate);
    }

    const salesData = await prisma.sales.findMany({ where: filter });

    if (analyticsType === "TOTAL_SALES") {
      const total = salesData.reduce((acc, sale) => acc + sale.total, 0);
      return `Total sales: RM ${total.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    } else if (analyticsType === "AVERAGE_SALES") {
      const total = salesData.reduce((acc, sale) => acc + sale.total, 0);
      const average = salesData.length > 0 ? total / salesData.length : 0;
      return `Average sale: RM ${average.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    } else if (analyticsType === "SALES_COUNT") {
      return `Number of sales: ${salesData.length}`;
    }
    return "Invalid analytics type provided.";
  },
});

/**
 * Tool to retrieve sales records using flexible filters.
 * Supports filtering by date range, payment method, invoice substring, and customer name substring.
 */
export const getSalesFiltered = tool({
  description:
    "Retrieve sales records based on filters such as date range, payment method, invoice, or customer name.",
  parameters: z.object({
    startDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Start date in ISO format (e.g., 2025-01-01)"),
    endDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("End date in ISO format (e.g., 2025-01-31)"),
    paymentMethod: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Payment method to filter by"),
    invoice: z.string().optional().describe("Invoice substring to filter by"),
    customer: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Customer name substring to filter by"),
  }),
  execute: async ({ startDate, endDate, paymentMethod, invoice, customer }) => {
    const filter: Record<string, any> = {};
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.gte = new Date(startDate);
      if (endDate) filter.purchaseDate.lte = new Date(endDate);
    }
    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }
    if (invoice) {
      filter.invoice = { contains: invoice };
    }
    if (customer) {
      filter.customer = { contains: customer, mode: "insensitive" };
    }

    const salesData = await prisma.sales.findMany({
      where: filter,
      orderBy: { purchaseDate: "desc" },
    });

    if (salesData.length === 0) {
      return "No sales records found for the given filters.";
    }

    const formatted = salesData
      .map(
        (sale) =>
          `Invoice: ${sale.invoice}, Customer: ${
            sale.customer
          }, PurchaseDate: ${sale.purchaseDate.toISOString()}, Total: ${
            sale.total
          }`
      )
      .join("\n");

    return formatted;
  },
});

/**
 * Tool to get a summary of sales grouped by payment method.
 * Optionally accepts a date range filter.
 */
export const getSalesSummary = tool({
  description:
    "Get a summary of sales aggregated by payment method within an optional date range.",
  parameters: z.object({
    startDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Start date in ISO format (e.g., 2025-01-01)"),
    endDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("End date in ISO format (e.g., 2025-01-31)"),
  }),
  execute: async ({ startDate, endDate }) => {
    const filter: Record<string, any> = {};
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.gte = new Date(startDate);
      if (endDate) filter.purchaseDate.lte = new Date(endDate);
    }

    const salesData = await prisma.sales.findMany({ where: filter });

    if (salesData.length === 0) {
      return "No sales records found for the given filters.";
    }

    // Group sales by payment method.
    const summary = salesData.reduce(
      (acc: Record<string, { count: number; total: number }>, sale) => {
        const key = sale.paymentMethod;
        if (!acc[key]) {
          acc[key] = { count: 0, total: 0 };
        }
        acc[key].count += 1;
        acc[key].total += sale.total;
        return acc;
      },
      {}
    );

    const result = Object.entries(summary)
      .map(
        ([method, data]) =>
          `Payment Method: ${method}, Count: ${
            data.count
          }, Total: RM ${data.total.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
      )
      .join("\n");

    return result;
  },
});

/**
 * Tool to get information from the database using RAG.
 */
export const getInformation = tool({
  description: `Get information from your knowledge sales database to answer questions ONLY when semantic search is required, RAG.`,
  parameters: z.object({
    query: z
      .string()
      .describe("interpreted user request from full chat context"),
  }),
  execute: async ({ query }) => await retrieveRelevantSales(query),
});

/**
 * Tool to analyze sales trends over time.
 * Groups sales by day, week, or month and returns total sales and count.
 */
export const getSalesTrend = tool({
  description:
    "Analyze sales trends over time grouped by day, week, or month. Returns aggregated total sales and count per period.",
  parameters: z.object({
    startDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Start date in ISO format (e.g., 2025-01-01)"),
    endDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("End date in ISO format (e.g., 2025-01-31)"),
    groupBy: z
      .enum(["DAY", "WEEK", "MONTH"])
      .describe("Interval to group sales by"),
  }),
  execute: async ({ startDate, endDate, groupBy }) => {
    const filter: Record<string, any> = {};
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.gte = new Date(startDate);
      if (endDate) filter.purchaseDate.lte = new Date(endDate);
    }
    const salesData = await prisma.sales.findMany({ where: filter });

    const groups: Record<string, { totalSales: number; count: number }> = {};
    salesData.forEach((sale) => {
      const date = new Date(sale.purchaseDate);
      let key: string;
      if (groupBy === "DAY") {
        key = date.toISOString().split("T")[0]; // YYYY-MM-DD
      } else if (groupBy === "WEEK") {
        const year = date.getFullYear();
        const firstDay = new Date(date.getFullYear(), 0, 1);
        const week = Math.ceil(
          ((date.getTime() - firstDay.getTime()) / 86400000 +
            firstDay.getDay() +
            1) /
            7
        );
        key = `${year}-W${week}`;
      } else {
        key = `${date.getFullYear()}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, "0")}`; // YYYY-MM
      }
      if (!groups[key]) {
        groups[key] = { totalSales: 0, count: 0 };
      }
      groups[key].totalSales += sale.total;
      groups[key].count += 1;
    });

    return Object.entries(groups)
      .map(
        ([period, data]) =>
          `Period: ${period}, Total Sales: RM ${data.totalSales.toLocaleString(
            "en-US",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}, Sales Count: ${data.count}`
      )
      .join("\n");
  },
});

/**
 * Tool to retrieve the top customers based on total sales.
 * Optionally filters by a date range and returns a limited list.
 */
export const getTopCustomers = tool({
  description:
    "Retrieve top customers based on total sales amount within an optional date range.",
  parameters: z.object({
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
      .describe("Maximum number of customers to return"),
  }),
  execute: async ({ startDate, endDate, limit = 5 }) => {
    const filter: Record<string, any> = {};
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.gte = new Date(startDate);
      if (endDate) filter.purchaseDate.lte = new Date(endDate);
    }
    const salesData = await prisma.sales.findMany({ where: filter });

    const customerTotals: Record<string, number> = {};
    salesData.forEach((sale) => {
      if (!customerTotals[sale.customer]) {
        customerTotals[sale.customer] = 0;
      }
      customerTotals[sale.customer] += sale.total;
    });

    const topCustomers = Object.entries(customerTotals)
      .sort(([, totalA], [, totalB]) => totalB - totalA)
      .slice(0, limit || 5)
      .map(
        ([customer, total]) =>
          `Customer: ${customer}, Total Sales: RM ${total.toLocaleString(
            "en-US",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}`
      )
      .join("\n");

    return topCustomers || "No sales records found for the given filters.";
  },
});

/**
 * Tool to analyze sales per item.
 * Aggregates total quantity sold, total sales, and average price per item.
 */
export const getItemSalesAnalysis = tool({
  description:
    "Provide analysis PER item (Not null) including total quantity sold, total sales amount, and average sale price.",
  parameters: z.object({
    startDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Start date in ISO format (e.g., 2025-01-01)"),
    endDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("End date in ISO format (e.g., 2025-01-31)"),
    item: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Item substring to filter by"),
  }),
  execute: async ({ startDate, endDate, item }) => {
    const filter: Record<string, any> = {};
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.gte = new Date(startDate);
      if (endDate) filter.purchaseDate.lte = new Date(endDate);
    }
    if (item) {
      filter.item = { contains: item, mode: "insensitive" };
    }
    const salesData = await prisma.sales.findMany({ where: filter });

    if (salesData.length === 0) {
      return "No sales records found for the given filters.";
    }

    const itemStats: Record<
      string,
      { totalQuantity: number; totalSales: number; totalPrice: number }
    > = {};

    salesData.forEach((sale) => {
      const key = sale.item;
      if (!itemStats[key]) {
        itemStats[key] = { totalQuantity: 0, totalSales: 0, totalPrice: 0 };
      }
      itemStats[key].totalQuantity += sale.quantity;
      itemStats[key].totalSales += sale.total;
      // Calculate total price by multiplying price and quantity
      itemStats[key].totalPrice += sale.price * sale.quantity;
    });

    const result = Object.entries(itemStats)
      .map(([itemName, data]) => {
        const averagePrice =
          data.totalQuantity > 0 ? data.totalPrice / data.totalQuantity : 0;
        return `Item: ${itemName}, Total Quantity Sold: ${
          data.totalQuantity
        }, Total Sales: RM ${data.totalSales.toFixed(
          2
        )}, Average Price: RM ${averagePrice.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      })
      .join("\n");

    return result;
  },
});

/**
 * Tool to list the unique payment methods available in the sales dataset.
 */
export const listPaymentMethods = tool({
  description:
    "Retrieve the list of unique payment methods available in the sales dataset.",
  parameters: z.object({}),
  execute: async () => {
    const paymentMethods = await prisma.sales.findMany({
      select: { paymentMethod: true },
      distinct: ["paymentMethod"],
    });
    const methods = paymentMethods.map((pm) => pm.paymentMethod);
    return methods.length
      ? `Available payment methods: ${methods.join(", ")}`
      : "No payment methods found.";
  },
});

/**
 * Tool to analyze sales by region or state.
 * Extracts the region (assumed to be the last segment of the customer address if comma-separated),
 * then aggregates sales data per region.
 */
export const getSalesByRegion = tool({
  description:
    "Analyze sales trends by region or state. Uses the full customer address to aggregate sales data. The full address is provided for downstream interpretation of region details.",
  parameters: z.object({
    startDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Start date in ISO format (e.g., 2025-01-01)"),
    endDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("End date in ISO format (e.g., 2025-01-31)"),
  }),
  execute: async ({ startDate, endDate }) => {
    const filter: Record<string, any> = {};
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.gte = new Date(startDate);
      if (endDate) filter.purchaseDate.lte = new Date(endDate);
    }
    const salesData = await prisma.sales.findMany({ where: filter });
    if (salesData.length === 0) {
      return "No sales records found for the given filters.";
    }
    // Group sales by full address.
    const summary = salesData.reduce(
      (acc: Record<string, { count: number; total: number }>, sale) => {
        const key = sale.address;
        if (!acc[key]) {
          acc[key] = { count: 0, total: 0 };
        }
        acc[key].count += 1;
        acc[key].total += sale.total;
        return acc;
      },
      {}
    );
    const result = Object.entries(summary)
      .map(
        ([address, data]) =>
          `Address: ${address}, Count: ${
            data.count
          }, Total: RM ${data.total.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
      )
      .join("\n");
    return result;
  },
});

/**
 * Tool to list down the top-selling (hot) items within a specific region.
 * Items are ranked by either quantity sold or total sales amount.
 */
export const getHotItemsByRegion = tool({
  description:
    "List top-selling items within a specific region or state filter. Filters sales by checking if the full address includes the provided region substring, and returns items ranked by quantity or total sales.",
  parameters: z.object({
    region: z
      .string()
      .describe("Region or state to filter sales by (e.g., Johor)"),
    startDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Start date in ISO format (e.g., 2025-01-01)"),
    endDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("End date in ISO format (e.g., 2025-01-31)"),
    sortBy: z
      .preprocess(
        nullToUndefined,
        z
          .enum(["QUANTITY", "TOTAL_SALES"])
          .optional()
          .nullable()
          .default("QUANTITY")
      )
      .describe("Sort items by quantity sold or total sales amount"),
    limit: z
      .preprocess((arg) => {
        const val = nullToUndefined(arg);
        return typeof val === "string" ? parseFloat(val) : val;
      }, z.number().optional().nullable().default(5))
      .describe("Maximum number of items to return"),
  }),
  execute: async ({ region, startDate, endDate, sortBy, limit }) => {
    const filter: Record<string, any> = {};
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.gte = new Date(startDate);
      if (endDate) filter.purchaseDate.lte = new Date(endDate);
    }
    const salesData = await prisma.sales.findMany({ where: filter });
    // Use full address and check if it includes the provided substring.
    const regionFiltered = salesData.filter((sale) =>
      sale.address.toLowerCase().includes(region.toLowerCase())
    );
    // Group sales by item.
    const itemMap: Record<
      string,
      { totalQuantity: number; totalSales: number }
    > = {};
    regionFiltered.forEach((sale) => {
      const key = sale.item;
      if (!itemMap[key]) {
        itemMap[key] = { totalQuantity: 0, totalSales: 0 };
      }
      itemMap[key].totalQuantity += sale.quantity;
      itemMap[key].totalSales += sale.total;
    });
    let items = Object.entries(itemMap).map(([item, stats]) => ({
      item,
      ...stats,
    }));
    if (sortBy === "TOTAL_SALES") {
      items = items.sort((a, b) => b.totalSales - a.totalSales);
    } else {
      items = items.sort((a, b) => b.totalQuantity - a.totalQuantity);
    }
    const topItems = items.slice(0, limit || 5);
    if (topItems.length === 0)
      return "No hot items found for the given region and filters.";
    return topItems
      .map(
        (item) =>
          `Item: ${item.item}, Quantity Sold: ${
            item.totalQuantity
          }, Total Sales: RM ${item.totalSales.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
      )
      .join("\n");
  },
});

/**
 * Tool to aggregate invoice trends by region.
 * When a region is provided, returns the unique invoice count, total invoice amount, and average invoice value for that region.
 * Otherwise, groups results by region.
 */
export const getInvoiceTrendsByRegion = tool({
  description:
    "Aggregate invoice trends by region or state. Filters sales by checking if the full address includes the region substring (if provided), then aggregates unique invoice count, total invoice amount, and average invoice value.",
  parameters: z.object({
    region: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Optional region to filter by (e.g., Johor)"),
    startDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("Start date in ISO format (e.g., 2025-01-01)"),
    endDate: z
      .preprocess(nullToUndefined, z.string().optional().nullable())
      .describe("End date in ISO format (e.g., 2025-01-31)"),
  }),
  execute: async ({ region, startDate, endDate }) => {
    const filter: Record<string, any> = {};
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.gte = new Date(startDate);
      if (endDate) filter.purchaseDate.lte = new Date(endDate);
    }
    const salesData = await prisma.sales.findMany({ where: filter });
    if (region) {
      // Filter sales by the provided address substring.
      const regionSales = salesData.filter((sale) =>
        sale.address.toLowerCase().includes(region.toLowerCase())
      );
      const invoiceMap: Record<string, { total: number }> = {};
      regionSales.forEach((sale) => {
        if (!invoiceMap[sale.invoice]) {
          invoiceMap[sale.invoice] = { total: 0 };
        }
        invoiceMap[sale.invoice].total += sale.total;
      });
      const invoices = Object.values(invoiceMap);
      const invoiceCount = invoices.length;
      const totalInvoiceAmount = invoices.reduce(
        (acc, inv) => acc + inv.total,
        0
      );
      const averageInvoiceValue =
        invoiceCount > 0 ? totalInvoiceAmount / invoiceCount : 0;
      return `Region Filter: ${region}\nUnique Invoices: ${invoiceCount}\nTotal Invoice Amount: RM ${totalInvoiceAmount.toFixed(
        2
      )}\nAverage Invoice Value: RM ${averageInvoiceValue.toLocaleString(
        "en-US",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      )}`;
    } else {
      // Group by full address.
      const regionMap: Record<
        string,
        { invoices: Record<string, { total: number }> }
      > = {};
      salesData.forEach((sale) => {
        const saleAddress = sale.address;
        if (!regionMap[saleAddress]) {
          regionMap[saleAddress] = { invoices: {} };
        }
        if (!regionMap[saleAddress].invoices[sale.invoice]) {
          regionMap[saleAddress].invoices[sale.invoice] = { total: 0 };
        }
        regionMap[saleAddress].invoices[sale.invoice].total += sale.total;
      });
      const result = Object.entries(regionMap).map(([addr, data]) => {
        const invoiceCount = Object.keys(data.invoices).length;
        const totalInvoiceAmount = Object.values(data.invoices).reduce(
          (acc, inv) => acc + inv.total,
          0
        );
        const averageInvoiceValue =
          invoiceCount > 0 ? totalInvoiceAmount / invoiceCount : 0;
        return `Address: ${addr}, Unique Invoices: ${invoiceCount}, Total Invoice Amount: RM ${totalInvoiceAmount.toFixed(
          2
        )}, Average Invoice Value: RM ${averageInvoiceValue.toLocaleString(
          "en-US",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}`;
      });
      return result.join("\n");
    }
  },
});

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

    return `Invoice: ${invoice}\n${details}\nOverall Invoice Total: RM ${totalInvoiceAmount.toFixed(
      2
    )}`;
  },
});

/**
 * Tool to retrieve the unique regions from the sales dataset.
 * Extracts the region from the 'address' field by taking the last segment after a comma.
 */
export const listRegions = tool({
  description:
    "Retrieve the list of full addresses available in the sales dataset. Use these addresses to infer region or state details.",
  parameters: z.object({}),
  execute: async () => {
    const salesData = await prisma.sales.findMany({
      select: { address: true },
    });
    const addressesSet = new Set<string>();
    salesData.forEach((sale) => {
      addressesSet.add(sale.address);
    });
    const addresses = Array.from(addressesSet);
    return addresses.length
      ? `Available addresses: ${addresses.join(", ")}`
      : "No addresses found in the dataset.";
  },
});

/**
 * Retrieve top aggregates based on a flexible grouping.
 * Group by ITEM, STATE, CUSTOMER, INVOICE, or PAYMENT_METHOD
 * and sort by TOTAL_SALES, COUNT, or QUANTITY. Optionally filter by time period.
 */
export const getTopAggregates = tool({
  description:
    "Retrieve top aggregates based on a flexible grouping. Group by ITEM, STATE, CUSTOMER, INVOICE, or PAYMENT_METHOD and sort by TOTAL_SALES, COUNT, or QUANTITY. Optionally filter by time period.",
  parameters: z.object({
    groupBy: z
      .enum(["ITEM", "STATE", "CUSTOMER", "INVOICE", "PAYMENT_METHOD"])
      .describe("Field to group by"),
    sortBy: z
      .preprocess(
        nullToUndefined,
        z
          .enum(["TOTAL_SALES", "COUNT", "QUANTITY"])
          .optional()
          .nullable()
          .default("TOTAL_SALES")
      )
      .describe("Criteria to sort the groups"),
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
      .describe("Maximum number of groups to return"),
  }),
  execute: async ({ groupBy, sortBy, startDate, endDate, limit = 5 }) => {
    const filter: Record<string, any> = {};
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.gte = new Date(startDate);
      if (endDate) filter.purchaseDate.lte = new Date(endDate);
    }
    const salesData = await prisma.sales.findMany({ where: filter });
    if (salesData.length === 0)
      return "No sales records found for the given filters.";

    const getGroupKey = (sale: any): string => {
      switch (groupBy) {
        case "STATE":
          return sale.address;
        case "ITEM":
          return sale.item;
        case "CUSTOMER":
          return sale.customer;
        case "INVOICE":
          return sale.invoice;
        case "PAYMENT_METHOD":
          return sale.paymentMethod;
        default:
          return "Unknown";
      }
    };

    const aggregates: Record<
      string,
      { count: number; totalSales: number; totalQuantity: number }
    > = {};
    salesData.forEach((sale) => {
      const key = getGroupKey(sale);
      if (!aggregates[key]) {
        aggregates[key] = { count: 0, totalSales: 0, totalQuantity: 0 };
      }
      aggregates[key].count += 1;
      aggregates[key].totalSales += sale.total;
      aggregates[key].totalQuantity += sale.quantity;
    });

    let groups = Object.entries(aggregates).map(([group, data]) => ({
      group,
      ...data,
    }));

    if (sortBy === "COUNT") {
      groups = groups.sort((a, b) => b.count - a.count);
    } else if (sortBy === "QUANTITY") {
      groups = groups.sort((a, b) => b.totalQuantity - a.totalQuantity);
    } else {
      groups = groups.sort((a, b) => b.totalSales - a.totalSales);
    }

    const topGroups = groups.slice(0, limit || 5);
    if (topGroups.length === 0) return "No groups found for the given filters.";

    return topGroups
      .map(
        (groupData) =>
          `Group (${groupBy}): ${groupData.group}, Count: ${
            groupData.count
          }, Total Sales: RM ${groupData.totalSales.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}, Total Quantity: ${groupData.totalQuantity}`
      )
      .join("\n");
  },
});
