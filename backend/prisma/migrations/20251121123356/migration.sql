/*
  Warnings:

  - You are about to drop the column `customer_complaint` on the `service_orders` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."image_entity_type" AS ENUM ('bike', 'service_order', 'customer', 'part', 'comment', 'service_item');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."payment_method" ADD VALUE 'ewallet_momo';
ALTER TYPE "public"."payment_method" ADD VALUE 'ewallet_zalopay';
ALTER TYPE "public"."payment_method" ADD VALUE 'ewallet_vnpay';
ALTER TYPE "public"."payment_method" ADD VALUE 'bank_transfer';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."user_role" ADD VALUE 'store_manager';
ALTER TYPE "public"."user_role" ADD VALUE 'sales_associate';
ALTER TYPE "public"."user_role" ADD VALUE 'warehouse_staff';

-- DropIndex
DROP INDEX "bikes_license_plate_key";

-- DropIndex
DROP INDEX "idx_bikes_license";

-- AlterTable
ALTER TABLE "public"."customers" ADD COLUMN     "birthday" DATE,
ADD COLUMN     "facebook" VARCHAR(255),
ADD COLUMN     "instagram" VARCHAR(255),
ADD COLUMN     "salesperson_id" UUID;

-- AlterTable
ALTER TABLE "public"."service_items" ADD COLUMN     "assigned_employee_id" UUID;

-- AlterTable
ALTER TABLE "public"."service_orders" DROP COLUMN "customer_complaint",
ADD COLUMN     "created_by_id" UUID,
ADD COLUMN     "customer_demand" TEXT;

-- CreateTable
CREATE TABLE "public"."inventory" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "location_id" UUID NOT NULL,
    "product_id" UUID,
    "product_variant_id" UUID,
    "quantity_on_hand" INTEGER DEFAULT 0,
    "quantity_reserved" INTEGER DEFAULT 0,
    "quantity_on_order" INTEGER DEFAULT 0,
    "safety_stock" INTEGER DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_transactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "location_id" UUID NOT NULL,
    "product_id" UUID,
    "product_variant_id" UUID,
    "transaction_type" VARCHAR(50) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(10,2),
    "total_cost" DECIMAL(10,2),
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
    "reason_code" VARCHAR(50),
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pos_session_transactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "pos_session_id" UUID NOT NULL,
    "transaction_type" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_session_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pos_sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "session_number" VARCHAR(50) NOT NULL,
    "location_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(50) DEFAULT 'open',
    "opening_cash" DECIMAL(10,2) DEFAULT 0,
    "closing_cash" DECIMAL(10,2),
    "expected_cash" DECIMAL(10,2),
    "cash_difference" DECIMAL(10,2),
    "opened_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "parent_id" UUID,
    "display_order" INTEGER DEFAULT 0,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_variants" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "product_id" UUID NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "attributes" JSONB,
    "price_adjustment" DECIMAL(10,2) DEFAULT 0,
    "cost_price_override" DECIMAL(10,2),
    "retail_price_override" DECIMAL(10,2),
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "sku" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category_id" UUID,
    "brand_id" UUID,
    "supplier_id" UUID,
    "cost_price" DECIMAL(10,2) DEFAULT 0,
    "retail_price" DECIMAL(10,2) NOT NULL,
    "sale_price" DECIMAL(10,2),
    "sale_price_start_date" TIMESTAMPTZ(6),
    "sale_price_end_date" TIMESTAMPTZ(6),
    "reorder_point" INTEGER DEFAULT 0,
    "reorder_quantity" INTEGER DEFAULT 0,
    "product_type" VARCHAR(50) DEFAULT 'physical',
    "is_active" BOOLEAN DEFAULT true,
    "is_featured" BOOLEAN DEFAULT false,
    "weight" DECIMAL(10,2),
    "dimensions_length" DECIMAL(10,2),
    "dimensions_width" DECIMAL(10,2),
    "dimensions_height" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "master_product_id" UUID,
    "is_master" BOOLEAN DEFAULT true,
    "variant_generation_type" VARCHAR(50) DEFAULT 'manual',
    "attributes" JSONB DEFAULT '{}',

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sales_order_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "sales_order_id" UUID NOT NULL,
    "product_id" UUID,
    "product_variant_id" UUID,
    "product_name" VARCHAR(255) NOT NULL,
    "product_sku" VARCHAR(100),
    "variant_name" VARCHAR(255),
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "discount_amount" DECIMAL(10,2) DEFAULT 0,
    "tax_amount" DECIMAL(10,2) DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "unit_cost" DECIMAL(10,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sales_order_payments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "sales_order_id" UUID NOT NULL,
    "payment_method" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_date" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "transaction_id" VARCHAR(255),
    "authorization_code" VARCHAR(100),
    "amount_tendered" DECIMAL(10,2),
    "change_given" DECIMAL(10,2),
    "status" VARCHAR(50) DEFAULT 'completed',
    "notes" TEXT,
    "received_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sales_orders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_number" VARCHAR(50) NOT NULL,
    "customer_id" UUID,
    "customer_name" VARCHAR(255) NOT NULL,
    "customer_phone" VARCHAR(20),
    "customer_email" VARCHAR(255),
    "channel" VARCHAR(50) NOT NULL,
    "location_id" UUID,
    "status" VARCHAR(50) DEFAULT 'pending',
    "payment_status" VARCHAR(50) DEFAULT 'unpaid',
    "shipping_address" TEXT,
    "shipping_city" VARCHAR(100),
    "shipping_method" VARCHAR(50),
    "tracking_number" VARCHAR(100),
    "order_date" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "payment_date" TIMESTAMPTZ(6),
    "shipped_date" TIMESTAMPTZ(6),
    "delivered_date" TIMESTAMPTZ(6),
    "subtotal" DECIMAL(10,2) DEFAULT 0,
    "discount_amount" DECIMAL(10,2) DEFAULT 0,
    "tax_amount" DECIMAL(10,2) DEFAULT 0,
    "shipping_cost" DECIMAL(10,2) DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) DEFAULT 0,
    "notes" TEXT,
    "internal_notes" TEXT,
    "created_by" UUID,
    "processed_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_locations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "address" TEXT,
    "city" VARCHAR(100),
    "phone" VARCHAR(20),
    "is_active" BOOLEAN DEFAULT true,
    "is_default" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transfer_order_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "transfer_order_id" UUID NOT NULL,
    "product_id" UUID,
    "product_variant_id" UUID,
    "quantity_requested" INTEGER NOT NULL,
    "quantity_shipped" INTEGER DEFAULT 0,
    "quantity_received" INTEGER DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transfer_orders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "transfer_number" VARCHAR(50) NOT NULL,
    "from_location_id" UUID NOT NULL,
    "to_location_id" UUID NOT NULL,
    "status" VARCHAR(50) DEFAULT 'pending',
    "requested_date" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "shipped_date" TIMESTAMPTZ(6),
    "received_date" TIMESTAMPTZ(6),
    "requested_by" UUID,
    "shipped_by" UUID,
    "received_by" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."images" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "entity_type" "public"."image_entity_type" NOT NULL,
    "entity_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" VARCHAR(100),
    "storage_bucket" VARCHAR(100) NOT NULL DEFAULT 'bikes',
    "public_url" TEXT NOT NULL,
    "display_order" INTEGER DEFAULT 0,
    "is_primary" BOOLEAN DEFAULT false,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."attribute_definitions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "input_type" VARCHAR(50) DEFAULT 'select',
    "data_type" VARCHAR(50) DEFAULT 'string',
    "is_variant_attribute" BOOLEAN DEFAULT true,
    "is_filterable" BOOLEAN DEFAULT true,
    "is_required" BOOLEAN DEFAULT false,
    "options" JSONB DEFAULT '[]',
    "validation_rules" JSONB DEFAULT '{}',
    "display_order" INTEGER DEFAULT 0,
    "icon" VARCHAR(100),
    "help_text" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permission_audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "resource_type" VARCHAR(100),
    "resource_id" UUID,
    "changes" JSONB,
    "performed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "conditions" JSONB,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "public"."user_permissions" (
    "user_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "assigned_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,
    "reason" TEXT,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("user_id","permission_id")
);

-- CreateIndex
CREATE INDEX "idx_inventory_location" ON "public"."inventory"("location_id");

-- CreateIndex
CREATE INDEX "idx_inventory_product" ON "public"."inventory"("product_id");

-- CreateIndex
CREATE INDEX "idx_inventory_variant" ON "public"."inventory"("product_variant_id");

-- CreateIndex
CREATE INDEX "idx_inventory_transactions_created_at" ON "public"."inventory_transactions"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_inventory_transactions_location" ON "public"."inventory_transactions"("location_id");

-- CreateIndex
CREATE INDEX "idx_inventory_transactions_product" ON "public"."inventory_transactions"("product_id");

-- CreateIndex
CREATE INDEX "idx_inventory_transactions_reference" ON "public"."inventory_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "idx_inventory_transactions_type" ON "public"."inventory_transactions"("transaction_type");

-- CreateIndex
CREATE INDEX "idx_inventory_transactions_variant" ON "public"."inventory_transactions"("product_variant_id");

-- CreateIndex
CREATE INDEX "idx_pos_session_transactions_session" ON "public"."pos_session_transactions"("pos_session_id");

-- CreateIndex
CREATE INDEX "idx_pos_session_transactions_type" ON "public"."pos_session_transactions"("transaction_type");

-- CreateIndex
CREATE UNIQUE INDEX "pos_sessions_session_number_key" ON "public"."pos_sessions"("session_number");

-- CreateIndex
CREATE INDEX "idx_pos_sessions_location" ON "public"."pos_sessions"("location_id");

-- CreateIndex
CREATE INDEX "idx_pos_sessions_number" ON "public"."pos_sessions"("session_number");

-- CreateIndex
CREATE INDEX "idx_pos_sessions_opened_at" ON "public"."pos_sessions"("opened_at" DESC);

-- CreateIndex
CREATE INDEX "idx_pos_sessions_status" ON "public"."pos_sessions"("status");

-- CreateIndex
CREATE INDEX "idx_pos_sessions_user" ON "public"."pos_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "public"."product_categories"("slug");

-- CreateIndex
CREATE INDEX "idx_product_categories_active" ON "public"."product_categories"("is_active");

-- CreateIndex
CREATE INDEX "idx_product_categories_parent" ON "public"."product_categories"("parent_id");

-- CreateIndex
CREATE INDEX "idx_product_categories_slug" ON "public"."product_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "public"."product_variants"("sku");

-- CreateIndex
CREATE INDEX "idx_product_variants_active" ON "public"."product_variants"("is_active");

-- CreateIndex
CREATE INDEX "idx_product_variants_product" ON "public"."product_variants"("product_id");

-- CreateIndex
CREATE INDEX "idx_product_variants_sku" ON "public"."product_variants"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "public"."products"("sku");

-- CreateIndex
CREATE INDEX "idx_products_active" ON "public"."products"("is_active");

-- CreateIndex
CREATE INDEX "idx_products_brand" ON "public"."products"("brand_id");

-- CreateIndex
CREATE INDEX "idx_products_category" ON "public"."products"("category_id");

-- CreateIndex
CREATE INDEX "idx_products_sku" ON "public"."products"("sku");

-- CreateIndex
CREATE INDEX "idx_products_supplier" ON "public"."products"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_products_attributes_gin" ON "public"."products" USING GIN ("attributes");

-- CreateIndex
CREATE INDEX "idx_products_is_master" ON "public"."products"("is_master");

-- CreateIndex
CREATE INDEX "idx_sales_order_items_order" ON "public"."sales_order_items"("sales_order_id");

-- CreateIndex
CREATE INDEX "idx_sales_order_items_product" ON "public"."sales_order_items"("product_id");

-- CreateIndex
CREATE INDEX "idx_sales_order_items_variant" ON "public"."sales_order_items"("product_variant_id");

-- CreateIndex
CREATE INDEX "idx_sales_order_payments_date" ON "public"."sales_order_payments"("payment_date" DESC);

-- CreateIndex
CREATE INDEX "idx_sales_order_payments_method" ON "public"."sales_order_payments"("payment_method");

-- CreateIndex
CREATE INDEX "idx_sales_order_payments_order" ON "public"."sales_order_payments"("sales_order_id");

-- CreateIndex
CREATE INDEX "idx_sales_order_payments_status" ON "public"."sales_order_payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_order_number_key" ON "public"."sales_orders"("order_number");

-- CreateIndex
CREATE INDEX "idx_sales_orders_channel" ON "public"."sales_orders"("channel");

-- CreateIndex
CREATE INDEX "idx_sales_orders_customer" ON "public"."sales_orders"("customer_id");

-- CreateIndex
CREATE INDEX "idx_sales_orders_customer_phone" ON "public"."sales_orders"("customer_phone");

-- CreateIndex
CREATE INDEX "idx_sales_orders_location" ON "public"."sales_orders"("location_id");

-- CreateIndex
CREATE INDEX "idx_sales_orders_number" ON "public"."sales_orders"("order_number");

-- CreateIndex
CREATE INDEX "idx_sales_orders_order_date" ON "public"."sales_orders"("order_date" DESC);

-- CreateIndex
CREATE INDEX "idx_sales_orders_payment_status" ON "public"."sales_orders"("payment_status");

-- CreateIndex
CREATE INDEX "idx_sales_orders_status" ON "public"."sales_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_locations_code_key" ON "public"."stock_locations"("code");

-- CreateIndex
CREATE INDEX "idx_stock_locations_active" ON "public"."stock_locations"("is_active");

-- CreateIndex
CREATE INDEX "idx_stock_locations_code" ON "public"."stock_locations"("code");

-- CreateIndex
CREATE INDEX "idx_transfer_order_items_product" ON "public"."transfer_order_items"("product_id");

-- CreateIndex
CREATE INDEX "idx_transfer_order_items_transfer" ON "public"."transfer_order_items"("transfer_order_id");

-- CreateIndex
CREATE INDEX "idx_transfer_order_items_variant" ON "public"."transfer_order_items"("product_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_orders_transfer_number_key" ON "public"."transfer_orders"("transfer_number");

-- CreateIndex
CREATE INDEX "idx_transfer_orders_from_location" ON "public"."transfer_orders"("from_location_id");

-- CreateIndex
CREATE INDEX "idx_transfer_orders_number" ON "public"."transfer_orders"("transfer_number");

-- CreateIndex
CREATE INDEX "idx_transfer_orders_status" ON "public"."transfer_orders"("status");

-- CreateIndex
CREATE INDEX "idx_transfer_orders_to_location" ON "public"."transfer_orders"("to_location_id");

-- CreateIndex
CREATE INDEX "idx_images_entity" ON "public"."images"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_images_entity_id" ON "public"."images"("entity_id");

-- CreateIndex
CREATE INDEX "idx_images_is_primary" ON "public"."images"("entity_type", "entity_id", "is_primary");

-- CreateIndex
CREATE INDEX "idx_images_uploaded_by" ON "public"."images"("uploaded_by");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_definitions_slug_key" ON "public"."attribute_definitions"("slug");

-- CreateIndex
CREATE INDEX "idx_attr_def_active" ON "public"."attribute_definitions"("is_active");

-- CreateIndex
CREATE INDEX "idx_attr_def_options_gin" ON "public"."attribute_definitions" USING GIN ("options");

-- CreateIndex
CREATE INDEX "idx_attr_def_order" ON "public"."attribute_definitions"("display_order");

-- CreateIndex
CREATE INDEX "idx_attr_def_slug" ON "public"."attribute_definitions"("slug");

-- CreateIndex
CREATE INDEX "idx_permission_audit_log_created_at" ON "public"."permission_audit_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_permission_audit_log_performed_by" ON "public"."permission_audit_log"("performed_by");

-- CreateIndex
CREATE INDEX "idx_permission_audit_log_user_id" ON "public"."permission_audit_log"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "public"."permissions"("name");

-- CreateIndex
CREATE INDEX "idx_permissions_resource_action" ON "public"."permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "idx_role_permissions_permission_id" ON "public"."role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "idx_role_permissions_role_id" ON "public"."role_permissions"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "public"."roles"("name");

-- CreateIndex
CREATE INDEX "idx_user_roles_role_id" ON "public"."user_roles"("role_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_permissions_granted" ON "public"."user_permissions"("granted");

-- CreateIndex
CREATE INDEX "idx_user_permissions_permission_id" ON "public"."user_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "idx_user_permissions_user_id" ON "public"."user_permissions"("user_id");

-- CreateIndex
CREATE INDEX "idx_customers_birthday" ON "public"."customers"("birthday");

-- CreateIndex
CREATE INDEX "idx_customers_salesperson" ON "public"."customers"("salesperson_id");

-- CreateIndex
CREATE INDEX "idx_service_items_assigned_employee" ON "public"."service_items"("assigned_employee_id");

-- CreateIndex
CREATE INDEX "idx_service_orders_created_by" ON "public"."service_orders"("created_by_id");

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_salesperson_id_fkey" FOREIGN KEY ("salesperson_id") REFERENCES "public"."user_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."service_items" ADD CONSTRAINT "service_items_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."service_orders" ADD CONSTRAINT "service_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."user_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inventory" ADD CONSTRAINT "inventory_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."stock_locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inventory" ADD CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inventory" ADD CONSTRAINT "inventory_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."stock_locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pos_session_transactions" ADD CONSTRAINT "pos_session_transactions_pos_session_id_fkey" FOREIGN KEY ("pos_session_id") REFERENCES "public"."pos_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pos_sessions" ADD CONSTRAINT "pos_sessions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."stock_locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pos_sessions" ADD CONSTRAINT "pos_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."product_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_master_product_id_fkey" FOREIGN KEY ("master_product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."sales_order_items" ADD CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."sales_order_items" ADD CONSTRAINT "sales_order_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."sales_order_payments" ADD CONSTRAINT "sales_order_payments_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."sales_order_payments" ADD CONSTRAINT "sales_order_payments_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."sales_orders" ADD CONSTRAINT "sales_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."sales_orders" ADD CONSTRAINT "sales_orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."stock_locations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."sales_orders" ADD CONSTRAINT "sales_orders_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transfer_order_items" ADD CONSTRAINT "transfer_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transfer_order_items" ADD CONSTRAINT "transfer_order_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transfer_order_items" ADD CONSTRAINT "transfer_order_items_transfer_order_id_fkey" FOREIGN KEY ("transfer_order_id") REFERENCES "public"."transfer_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transfer_orders" ADD CONSTRAINT "transfer_orders_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "public"."stock_locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transfer_orders" ADD CONSTRAINT "transfer_orders_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transfer_orders" ADD CONSTRAINT "transfer_orders_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transfer_orders" ADD CONSTRAINT "transfer_orders_shipped_by_fkey" FOREIGN KEY ("shipped_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."transfer_orders" ADD CONSTRAINT "transfer_orders_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "public"."stock_locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."images" ADD CONSTRAINT "images_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."permission_audit_log" ADD CONSTRAINT "permission_audit_log_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."permission_audit_log" ADD CONSTRAINT "permission_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."user_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user_permissions" ADD CONSTRAINT "user_permissions_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."user_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user_permissions" ADD CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
