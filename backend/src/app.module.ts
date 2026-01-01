import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { CustomersModule } from './customers/customers.module';
import { BikesModule } from './bikes/bikes.module';
import { ServiceOrdersModule } from './service-orders/service-orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PartsModule } from './parts/parts.module';
import { UsersModule } from './users/users.module';
import { CommentsModule } from './comments/comments.module';
import { AuthModule } from './auth/auth.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { BrandsModule } from './brands/brands.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ServiceItemsModule } from './service-items/service-items.module';
import { ServicePartsModule } from './service-parts/service-parts.module';
import { ModelsModule } from './models/models.module';
import { ImagesModule } from './images/images.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { PosModule } from './pos/pos.module';
// import { ReportsModule } from './reports/reports.module'; // TODO: Fix reports module - uses outdated table names
import { ProductCategoriesModule } from './product-categories/product-categories.module';
import { AttributeDefinitionsModule } from './attribute-definitions/attribute-definitions.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AiModule } from './ai/ai.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { SupplierPaymentsModule } from './supplier-payments/supplier-payments.module';
import { SupplierReturnsModule } from './supplier-returns/supplier-returns.module';
import { StockLocationsModule } from './stock-locations/stock-locations.module';
import { StoresModule } from './stores/stores.module';
import { LoyaltyModule } from './loyalty/loyalty.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    CustomersModule,
    BikesModule,
    ServiceOrdersModule,
    PaymentsModule,
    PartsModule,
    UsersModule,
    CommentsModule,
    ActivityLogsModule,
    BrandsModule,
    SuppliersModule,
    PurchaseOrdersModule,
    SupplierPaymentsModule,
    SupplierReturnsModule,
    ServiceItemsModule,
    ServicePartsModule,
    ModelsModule,
    ImagesModule,
    ProductsModule,
    InventoryModule,
    SalesModule,
    PosModule,
    // ReportsModule, // TODO: Fix reports module - uses outdated table names
    ProductCategoriesModule,
    AttributeDefinitionsModule,
    PermissionsModule,
    AiModule,
    StockLocationsModule,
    StoresModule,
    LoyaltyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
