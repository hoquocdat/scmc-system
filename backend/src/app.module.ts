import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
