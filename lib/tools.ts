type ListOfTools = Record<string, { description: string }>;

export const listOfTools: ListOfTools = {
  getSalesAnalytics: {
    description:
      "Perform sales analytics, summary, detailed sales records, or trend analysis with flexible filters. Use the 'operation' field to choose the desired mode: 'FILTER' for detailed records, 'SUMMARY' for grouping by payment method, 'ANALYTICS' for total/average/count analytics, and 'TREND' for sales trends over time.",
  },
  // getSalesFiltered: {
  //   description:
  //     "Retrieve sales records based on filters such as date range, payment method, invoice substring, and customer name substring.",
  // },
  // getSalesSummary: {
  //   description:
  //     "Get a summary of sales aggregated by payment method within an optional date range.",
  // },
  getInformation: {
    description:
      "Get information from your knowledge sales database to answer questions when semantic search is required.",
  },
  // getSalesTrend: {
  //   description:
  //     "Analyze sales trends over time grouped by day, week, or month, returning aggregated total sales and count per period.",
  // },
  // getTopCustomers: {
  //   description:
  //     "Retrieve top customers based on total sales amount within an optional date range.",
  // },
  // getItemSalesAnalysis: {
  //   description:
  //     "Provide analysis per item including total quantity sold, total sales amount, and average sale price.",
  // },
  // listPaymentMethods: {
  //   description:
  //     "Retrieve the list of unique payment methods available in the sales dataset.",
  // },
  // getSalesByRegion: {
  //   description:
  //     "Analyze sales trends by region or state based on the customer address, grouping sales by region.",
  // },
  // getHotItemsByRegion: {
  //   description:
  //     "List the top-selling items (hot items) within a specific region, optionally filtered by date range.",
  // },
  // getInvoiceTrendsByRegion: {
  //   description:
  //     "Aggregate invoice trends by region. Optionally filter by a specific region along with a date range.",
  // },
  getInvoiceDetails: {
    description:
      "Retrieve detailed information for a given invoice, listing every item tied to that invoice and summing up the overall total.",
  },
  // listRegions: {
  //   description:
  //     "Retrieve the list of unique regions available in the sales dataset. Assumes the region is the last segment of the customer address.",
  // },
  getTopAggregates: {
    description:
      "Retrieve top aggregates based on a flexible grouping. For ITEM grouping, perform per-item analysis including average sale price; for other groups, return count, total sales, and total quantity. Optionally filter by time period and region. When a region is provided, invoice trends for that region are appended.",
  },
  getSalesMetaData: {
    description:
      "Retrieve metadata from the sales dataset. Query types: 'paymentMethods', 'regions', or 'dateRange'.",
  },
  // testSearchAggregates: {
  //   description:
  //     "Test search query based on provided filters. Returns the count of matching records and a sample of records. Confirm with the user if the results meet expectations before proceeding with full aggregation.",
  // },
};
