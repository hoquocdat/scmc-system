#!/bin/bash

# Script to replace "Technician" with "Employee" throughout the codebase
# Run this from the project root: bash rename-technicians-to-employees.sh

echo "🔄 Renaming Technicians to Employees..."

# Backend service file updates
echo "Updating backend service files..."
find backend/src -type f -name "*.ts" -exec sed -i '' \
  -e 's/technician_id/employee_id/g' \
  -e 's/technician_ids/employee_ids/g' \
  -e 's/assigned_technician/assigned_employee/g' \
  -e 's/getTechnicians/getEmployees/g' \
  -e 's/findByTechnician/findByEmployee/g' \
  -e 's/assignTechnician/assignEmployee/g' \
  -e 's/AssignTechnician/AssignEmployee/g' \
  -e 's/service_order_technicians/service_order_employees/g' \
  {} \;

# Frontend updates
echo "Updating frontend files..."
find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's/technician_id/employee_id/g' \
  -e 's/technician_ids/employee_ids/g' \
  -e 's/assigned_technician/assigned_employee/g' \
  -e 's/getTechnicians/getEmployees/g' \
  -e 's/assignTechnician/assignEmployee/g' \
  -e 's/Technician/Employee/g' \
  -e 's/technician/employee/g' \
  {} \;

# Update navigation labels (need to preserve case)
find frontend/src/components/layout -type f -name "*.tsx" -exec sed -i '' \
  -e "s/'Technicians'/'Employees'/g" \
  -e 's/"Technicians"/"Employees"/g' \
  -e "s/name: 'Technicians'/name: 'Employees'/g" \
  {} \;

# Update route paths
find frontend/src -type f \( -name "App.tsx" -o -name "*.tsx" \) -exec sed -i '' \
  -e "s/\/technicians/\/employees/g" \
  -e "s/'technicians'/'employees'/g" \
  {} \;

echo "✅ Text replacements complete!"
echo ""
echo "⚠️  Manual steps required:"
echo "1. Rename frontend/src/pages/TechniciansPage.tsx to EmployeesPage.tsx"
echo "2. Run the database migration: 004_rename_technicians_to_employees.sql"
echo "3. Update imports in files that reference TechniciansPage"
echo "4. Test the application thoroughly"
