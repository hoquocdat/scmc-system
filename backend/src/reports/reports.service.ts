import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // Helper to parse dates
  private parseDate(dateString?: string): Date | undefined {
    return dateString ? new Date(dateString) : undefined;
  }

  // Helper to get date range (defaults to current month)
  private getDateRange(startDate?: string, endDate?: string) {
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();
    return { start, end };
  }

  // ==================== SALES REPORTS ====================

  async getSalesSummary(startDate?: string, endDate?: string, location?: string) {
    const { start, end } = this.getDateRange(startDate, endDate);

    const whereClause: any = {
      created_at: {
        gte: start,
        lte: end,
      },
    };

    if (location) {
      whereClause.location_id = location;
    }

    // Get total revenue and order count
    const orders = await this.prisma.sales_orders.findMany({
      where: whereClause,
      include: {
        sales_order_items: true,
      },
    });

    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
    const totalOrders = orders.length;
    const totalItemsSold = orders.reduce(
      (sum, order) => sum + order.sales_order_items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    const totalDiscounts = orders.reduce((sum, order) => sum + Number(order.discount_amount || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate net revenue (after discounts, before VAT)
    const netRevenue = totalRevenue - totalDiscounts;

    return {
      period: { start, end },
      summary: {
        totalRevenue,
        netRevenue,
        totalOrders,
        totalItemsSold,
        totalDiscounts,
        averageOrderValue,
        vatCollected: netRevenue * 0.1, // 10% VAT
      },
    };
  }

  async getSalesByCategory(startDate?: string, endDate?: string) {
    const { start, end } = this.getDateRange(startDate, endDate);

    const sales = await this.prisma.$queryRaw`
      SELECT
        p.product_type as category,
        COUNT(DISTINCT pti.sales_order_id) as order_count,
        SUM(pti.quantity) as quantity_sold,
        SUM(pti.quantity * pti.unit_price) as revenue
      FROM sales_order_items pti
      JOIN sales_orders pt ON pti.sales_order_id = pt.id
      JOIN products p ON pti.product_id = p.id
      WHERE pt.created_at >= ${start} AND pt.created_at <= ${end}
      GROUP BY p.product_type
      ORDER BY revenue DESC
    `;

    return sales;
  }

  async getSalesByPaymentMethod(startDate?: string, endDate?: string) {
    const { start, end } = this.getDateRange(startDate, endDate);

    const sales = await this.prisma.payments.groupBy({
      by: ['payment_method'],
      where: {
        payment_date: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    return sales.map((item) => ({
      paymentMethod: item.payment_method,
      totalAmount: item._sum.amount || 0,
      transactionCount: item._count.id,
    }));
  }

  async getTopProducts(startDate?: string, endDate?: string, limit = 10) {
    const { start, end } = this.getDateRange(startDate, endDate);

    const topProducts = await this.prisma.$queryRaw`
      SELECT
        p.id,
        p.sku,
        p.name,
        SUM(pti.quantity) as quantity_sold,
        SUM(pti.quantity * pti.unit_price) as revenue
      FROM sales_order_items pti
      JOIN sales_orders pt ON pti.sales_order_id = pt.id
      JOIN products p ON pti.product_id = p.id
      WHERE pt.created_at >= ${start} AND pt.created_at <= ${end}
      GROUP BY p.id, p.sku, p.name
      ORDER BY quantity_sold DESC
      LIMIT ${limit}
    `;

    return topProducts;
  }

  async getSalesTrends(
    startDate?: string,
    endDate?: string,
    interval: 'daily' | 'weekly' | 'monthly' = 'daily',
  ) {
    const { start, end } = this.getDateRange(startDate, endDate);

    let dateFormat: string;
    switch (interval) {
      case 'daily':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'weekly':
        dateFormat = 'IYYY-IW'; // ISO week
        break;
      case 'monthly':
        dateFormat = 'YYYY-MM';
        break;
    }

    const trends = await this.prisma.$queryRaw`
      SELECT
        TO_CHAR(created_at, ${dateFormat}) as period,
        COUNT(*) as order_count,
        SUM(total_amount) as revenue,
        AVG(total_amount) as avg_order_value
      FROM sales_orders
      WHERE created_at >= ${start} AND created_at <= ${end}
      GROUP BY period
      ORDER BY period ASC
    `;

    return trends;
  }

  // ==================== INVENTORY REPORTS ====================

  async getInventoryValuation(location?: string) {
    const whereClause: any = {};
    if (location) {
      whereClause.location_id = location;
    }

    const inventory = await this.prisma.inventory.findMany({
      where: whereClause,
      include: {
        products: true,
        stock_locations: true,
      },
    });

    const totalValue = inventory.reduce((sum, item) => {
      if (!item.quantity_on_hand || !item.products) return sum;
      return sum + item.quantity_on_hand * Number(item.products.cost_price || 0);
    }, 0);

    const totalRetailValue = inventory.reduce((sum, item) => {
      if (!item.quantity_on_hand || !item.products) return sum;
      return sum + item.quantity_on_hand * Number(item.products.retail_price);
    }, 0);

    return {
      totalCostValue: totalValue,
      totalRetailValue: totalRetailValue,
      potentialProfit: totalRetailValue - totalValue,
      itemCount: inventory.length,
      totalUnits: inventory.reduce((sum, item) => sum + (item.quantity_on_hand || 0), 0),
      byLocation: await this.getInventoryByLocation(location),
    };
  }

  private async getInventoryByLocation(location?: string) {
    const whereClause: any = {};
    if (location) {
      whereClause.id = location;
    }

    const locations = await this.prisma.stock_locations.findMany({
      where: whereClause,
      include: {
        inventory: {
          include: {
            products: true,
          },
        },
      },
    });

    return locations.map((loc) => ({
      locationId: loc.id,
      locationName: loc.name,
      totalValue: loc.inventory.reduce((sum, item) => {
        if (!item.quantity_on_hand || !item.products) return sum;
        return sum + item.quantity_on_hand * Number(item.products.cost_price || 0);
      }, 0),
      totalUnits: loc.inventory.reduce((sum, item) => sum + (item.quantity_on_hand || 0), 0),
    }));
  }

  async getInventoryMovement(startDate?: string, endDate?: string, productId?: string) {
    const { start, end } = this.getDateRange(startDate, endDate);

    const whereClause: any = {
      created_at: {
        gte: start,
        lte: end,
      },
    };

    if (productId) {
      whereClause.product_id = productId;
    }

    const movements = await this.prisma.inventory_transactions.findMany({
      where: whereClause,
      include: {
        products: true,
        stock_locations: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return movements;
  }

  async getLowStockProducts(location?: string) {
    const whereClause: any = {};
    if (location) {
      whereClause.location_id = location;
    }

    // Find products where quantity_on_hand <= reorder_point
    const lowStock = await this.prisma.$queryRaw`
      SELECT
        inv.product_id,
        p.sku,
        p.name,
        inv.quantity_on_hand,
        p.reorder_point,
        p.reorder_quantity,
        sloc.name as location_name
      FROM inventory inv
      JOIN products p ON inv.product_id = p.id
      JOIN stock_locations sloc ON inv.location_id = sloc.id
      WHERE inv.quantity_on_hand <= p.reorder_point
        ${location ? Prisma.sql`AND inv.location_id = ${location}` : Prisma.empty}
      ORDER BY inv.quantity_on_hand ASC
    `;

    return lowStock;
  }

  async getInventoryTurnover(startDate?: string, endDate?: string) {
    const { start, end } = this.getDateRange(startDate, endDate);

    // Calculate inventory turnover: COGS / Average Inventory
    const turnover = await this.prisma.$queryRaw`
      SELECT
        p.id,
        p.sku,
        p.name,
        SUM(pti.quantity) as units_sold,
        SUM(pti.quantity * p.cost_price) as cogs,
        AVG(inv.quantity_on_hand) as avg_inventory,
        CASE
          WHEN AVG(inv.quantity_on_hand) > 0
          THEN SUM(pti.quantity) / AVG(inv.quantity_on_hand)
          ELSE 0
        END as turnover_ratio
      FROM products p
      LEFT JOIN sales_order_items pti ON p.id = pti.product_id
      LEFT JOIN sales_orders pt ON pti.sales_order_id = pt.id
      LEFT JOIN inventory inv ON p.id = inv.product_id
      WHERE pt.created_at >= ${start} AND pt.created_at <= ${end}
      GROUP BY p.id, p.sku, p.name
      HAVING SUM(pti.quantity) > 0
      ORDER BY turnover_ratio DESC
    `;

    return turnover;
  }

  // ==================== FINANCIAL REPORTS ====================

  async getRevenueReport(startDate?: string, endDate?: string) {
    const { start, end } = this.getDateRange(startDate, endDate);

    const payments = await this.prisma.payments.findMany({
      where: {
        payment_date: {
          gte: start,
          lte: end,
        },
      },
    });

    const grossRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Get total discounts
    const transactions = await this.prisma.sales_orders.findMany({
      where: {
        created_at: {
          gte: start,
          lte: end,
        },
      },
    });

    const totalDiscounts = transactions.reduce(
      (sum, t) => sum + Number(t.discount_amount || 0),
      0,
    );

    const netRevenue = grossRevenue - totalDiscounts;

    return {
      period: { start, end },
      grossRevenue,
      totalDiscounts,
      netRevenue,
      vatCollected: netRevenue * 0.1, // 10% VAT
      byPaymentMethod: await this.getSalesByPaymentMethod(startDate, endDate),
    };
  }

  async getProfitReport(startDate?: string, endDate?: string) {
    const { start, end } = this.getDateRange(startDate, endDate);

    // Calculate COGS (Cost of Goods Sold)
    const transactions = await this.prisma.sales_orders.findMany({
      where: {
        created_at: {
          gte: start,
          lte: end,
        },
      },
      include: {
        sales_order_items: {
          include: {
            products: true,
          },
        },
      },
    });

    let totalRevenue = 0;
    let totalCOGS = 0;

    transactions.forEach((transaction) => {
      totalRevenue += Number(transaction.total_amount);
      transaction.sales_order_items.forEach((item) => {
        if (item.products) {
          totalCOGS += item.quantity * Number(item.products.cost_price || 0);
        }
      });
    });

    const grossProfit = totalRevenue - totalCOGS;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      period: { start, end },
      totalRevenue,
      totalCOGS,
      grossProfit,
      grossMargin: grossMargin.toFixed(2) + '%',
    };
  }

  async getVATReport(startDate?: string, endDate?: string) {
    const { start, end } = this.getDateRange(startDate, endDate);

    const transactions = await this.prisma.sales_orders.findMany({
      where: {
        created_at: {
          gte: start,
          lte: end,
        },
      },
    });

    const subtotal = transactions.reduce(
      (sum, t) => sum + (Number(t.total_amount) - Number(t.discount_amount || 0)),
      0,
    );

    // In Vietnam, VAT is 10%
    const vatRate = 0.1;
    const vatCollected = subtotal * vatRate;

    return {
      period: { start, end },
      subtotal,
      vatRate: '10%',
      vatCollected,
      transactionCount: transactions.length,
      byDate: await this.getVATByDate(start, end),
    };
  }

  private async getVATByDate(start: Date, end: Date) {
    const vatByDate = await this.prisma.$queryRaw`
      SELECT
        DATE(created_at) as date,
        SUM(total_amount - COALESCE(discount_amount, 0)) as subtotal,
        SUM(total_amount - COALESCE(discount_amount, 0)) * 0.1 as vat_collected
      FROM sales_orders
      WHERE created_at >= ${start} AND created_at <= ${end}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return vatByDate;
  }

  // ==================== DASHBOARD KPIs ====================

  async getDashboardKPIs() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Today's metrics
    const todaySales = await this.getSalesSummary(
      today.toISOString(),
      new Date().toISOString(),
    );

    // Month-to-date metrics
    const monthSales = await this.getSalesSummary(
      startOfMonth.toISOString(),
      new Date().toISOString(),
    );

    // Inventory metrics
    const inventoryVal = await this.getInventoryValuation();
    const lowStock = await this.getLowStockProducts();

    // Pending orders count (if implemented)
    const pendingOrders = 0; // TODO: Implement when orders are added

    return {
      today: {
        revenue: todaySales.summary.totalRevenue,
        orders: todaySales.summary.totalOrders,
        averageOrderValue: todaySales.summary.averageOrderValue,
      },
      monthToDate: {
        revenue: monthSales.summary.totalRevenue,
        orders: monthSales.summary.totalOrders,
        averageOrderValue: monthSales.summary.averageOrderValue,
      },
      inventory: {
        totalValue: inventoryVal.totalCostValue,
        lowStockCount: Array.isArray(lowStock) ? lowStock.length : 0,
      },
      pendingOrders,
    };
  }
}
