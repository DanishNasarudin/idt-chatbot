type ListOfTools = Record<string, { description: string }>;

export const listOfTools: ListOfTools = {
  getSalesAnalytics: {
    description:
      "Perform sales analytics with optional filters for date range and payment method. Validates payment method against available ones.",
  },
  getSalesFiltered: {
    description:
      "Retrieve sales records based on filters such as date range, payment method, invoice substring, and customer name substring.",
  },
  getSalesSummary: {
    description:
      "Get a summary of sales aggregated by payment method within an optional date range.",
  },
  getInformation: {
    description:
      "Get information from your knowledge sales database to answer questions when semantic search is required.",
  },
  getSalesTrend: {
    description:
      "Analyze sales trends over time grouped by day, week, or month, returning aggregated total sales and count per period.",
  },
  getTopCustomers: {
    description:
      "Retrieve top customers based on total sales amount within an optional date range.",
  },
  getItemSalesAnalysis: {
    description:
      "Provide analysis per item including total quantity sold, total sales amount, and average sale price.",
  },
  listPaymentMethods: {
    description:
      "Retrieve the list of unique payment methods available in the sales dataset.",
  },
  getSalesByRegion: {
    description:
      "Analyze sales trends by region or state based on the customer address, grouping sales by region.",
  },
  getHotItemsByRegion: {
    description:
      "List the top-selling items (hot items) within a specific region, optionally filtered by date range.",
  },
  getInvoiceTrendsByRegion: {
    description:
      "Aggregate invoice trends by region. Optionally filter by a specific region along with a date range.",
  },
  getInvoiceDetails: {
    description:
      "Retrieve detailed information for a given invoice, listing every item tied to that invoice and summing up the overall total.",
  },
  listRegions: {
    description:
      "Retrieve the list of unique regions available in the sales dataset. Assumes the region is the last segment of the customer address.",
  },
  getTopAggregates: {
    description:
      "Retrieve top aggregates based on a flexible grouping. Group by ITEM, STATE, CUSTOMER, INVOICE, or PAYMENT_METHOD and sort by TOTAL_SALES, COUNT, or QUANTITY. Optionally filter by time period.",
  },
};
