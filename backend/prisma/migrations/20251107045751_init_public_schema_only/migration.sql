-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "public"."owner_type" AS ENUM ('individual', 'company');

-- CreateEnum
CREATE TYPE "public"."payment_method" AS ENUM ('cash', 'card', 'transfer');

-- CreateEnum
CREATE TYPE "public"."priority_level" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "public"."service_status" AS ENUM ('pending', 'confirmed', 'in_progress', 'waiting_parts', 'waiting_approval', 'quality_check', 'completed', 'ready_for_pickup', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."user_role" AS ENUM ('sales', 'technician', 'manager', 'finance');

-- CreateTable
CREATE TABLE "public"."activity_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bikes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "brand" VARCHAR(100) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "year" INTEGER,
    "license_plate" VARCHAR(20) NOT NULL,
    "vin" VARCHAR(50),
    "engine_number" VARCHAR(50),
    "color" VARCHAR(50),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "owner_id" UUID,
    "image_url" TEXT,

    CONSTRAINT "bikes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."brands" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "country_of_origin" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "full_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "id_number" VARCHAR(50),
    "address" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."models" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "brand_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "year_from" INTEGER,
    "year_to" INTEGER,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."parts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "part_number" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "quantity_in_stock" INTEGER DEFAULT 0,
    "minimum_stock_level" INTEGER DEFAULT 0,
    "unit_cost" DECIMAL(10,2),
    "supplier" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "supplier_id" UUID,
    "brand_id" UUID,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "service_order_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "public"."payment_method" NOT NULL,
    "is_deposit" BOOLEAN DEFAULT false,
    "payment_date" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "received_by" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "service_order_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "public"."service_status" DEFAULT 'pending',
    "labor_cost" DECIMAL(10,2) DEFAULT 0,
    "parts_cost" DECIMAL(10,2) DEFAULT 0,
    "hours_worked" DECIMAL(5,2) DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_order_comments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "service_order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "comment_text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_order_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_order_employees" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "service_order_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "is_primary" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_order_technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_orders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "order_number" VARCHAR(20) NOT NULL,
    "motorcycle_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "assigned_employee_id" UUID,
    "status" "public"."service_status" DEFAULT 'pending',
    "priority" "public"."priority_level" DEFAULT 'normal',
    "description" TEXT,
    "customer_complaint" TEXT,
    "mileage_in" INTEGER,
    "mileage_out" INTEGER,
    "drop_off_date" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "estimated_completion_date" TIMESTAMPTZ(6),
    "actual_completion_date" TIMESTAMPTZ(6),
    "pickup_date" TIMESTAMPTZ(6),
    "picked_up_by" VARCHAR(255),
    "pickup_id_verified" BOOLEAN DEFAULT false,
    "estimated_cost" DECIMAL(10,2),
    "final_cost" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "image_url" TEXT,

    CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_parts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "service_order_id" UUID NOT NULL,
    "service_item_id" UUID,
    "part_id" UUID NOT NULL,
    "quantity_used" INTEGER NOT NULL,
    "unit_cost" DECIMAL(10,2) NOT NULL,
    "total_cost" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."suppliers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_profiles" (
    "id" UUID NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_activity_logs_entity" ON "public"."activity_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_activity_logs_user" ON "public"."activity_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bikes_license_plate_key" ON "public"."bikes"("license_plate");

-- CreateIndex
CREATE INDEX "idx_bikes_license" ON "public"."bikes"("license_plate");

-- CreateIndex
CREATE INDEX "idx_brands_is_active" ON "public"."brands"("is_active");

-- CreateIndex
CREATE INDEX "idx_brands_name" ON "public"."brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_unique_idx" ON "public"."customers"("phone");

-- CreateIndex
CREATE INDEX "idx_models_brand_id" ON "public"."models"("brand_id");

-- CreateIndex
CREATE INDEX "idx_models_is_active" ON "public"."models"("is_active");

-- CreateIndex
CREATE INDEX "idx_models_name" ON "public"."models"("name");

-- CreateIndex
CREATE UNIQUE INDEX "models_brand_id_name_key" ON "public"."models"("brand_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "parts_part_number_key" ON "public"."parts"("part_number");

-- CreateIndex
CREATE INDEX "idx_parts_brand_id" ON "public"."parts"("brand_id");

-- CreateIndex
CREATE INDEX "idx_parts_supplier_id" ON "public"."parts"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_payments_order" ON "public"."payments"("service_order_id");

-- CreateIndex
CREATE INDEX "idx_service_items_order" ON "public"."service_items"("service_order_id");

-- CreateIndex
CREATE INDEX "idx_service_order_comments_created_at" ON "public"."service_order_comments"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_service_order_comments_service_order_id" ON "public"."service_order_comments"("service_order_id");

-- CreateIndex
CREATE INDEX "idx_service_order_comments_user_id" ON "public"."service_order_comments"("user_id");

-- CreateIndex
CREATE INDEX "idx_service_order_employees_employee" ON "public"."service_order_employees"("employee_id");

-- CreateIndex
CREATE INDEX "idx_service_order_employees_order" ON "public"."service_order_employees"("service_order_id");

-- CreateIndex
CREATE INDEX "idx_service_order_employees_primary" ON "public"."service_order_employees"("service_order_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "service_order_technicians_service_order_id_technician_id_key" ON "public"."service_order_employees"("service_order_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_orders_order_number_key" ON "public"."service_orders"("order_number");

-- CreateIndex
CREATE INDEX "idx_service_orders_customer" ON "public"."service_orders"("customer_id");

-- CreateIndex
CREATE INDEX "idx_service_orders_employee" ON "public"."service_orders"("assigned_employee_id");

-- CreateIndex
CREATE INDEX "idx_service_orders_motorcycle" ON "public"."service_orders"("motorcycle_id");

-- CreateIndex
CREATE INDEX "idx_service_orders_order_number" ON "public"."service_orders"("order_number");

-- CreateIndex
CREATE INDEX "idx_service_orders_status" ON "public"."service_orders"("status");

-- CreateIndex
CREATE INDEX "idx_service_parts_order" ON "public"."service_parts"("service_order_id");

-- CreateIndex
CREATE INDEX "idx_service_parts_part" ON "public"."service_parts"("part_id");

-- CreateIndex
CREATE INDEX "idx_suppliers_is_active" ON "public"."suppliers"("is_active");

-- CreateIndex
CREATE INDEX "idx_suppliers_name" ON "public"."suppliers"("name");

-- AddForeignKey
ALTER TABLE "public"."activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."bikes" ADD CONSTRAINT "bikes_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."models" ADD CONSTRAINT "models_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."parts" ADD CONSTRAINT "parts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."parts" ADD CONSTRAINT "parts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."service_items" ADD CONSTRAINT "service_items_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."service_order_comments" ADD CONSTRAINT "service_order_comments_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."service_order_comments" ADD CONSTRAINT "service_order_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."service_order_employees" ADD CONSTRAINT "service_order_technicians_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."service_order_employees" ADD CONSTRAINT "service_order_technicians_technician_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."service_orders" ADD CONSTRAINT "service_orders_assigned_technician_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."service_orders" ADD CONSTRAINT "service_orders_bike_id_fkey" FOREIGN KEY ("motorcycle_id") REFERENCES "public"."bikes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."service_orders" ADD CONSTRAINT "service_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."service_parts" ADD CONSTRAINT "service_parts_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."service_parts" ADD CONSTRAINT "service_parts_service_item_id_fkey" FOREIGN KEY ("service_item_id") REFERENCES "public"."service_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."service_parts" ADD CONSTRAINT "service_parts_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
