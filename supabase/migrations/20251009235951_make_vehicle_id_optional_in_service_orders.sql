/*
  # Make vehicle_id optional in service_orders

  1. Changes
    - Alter `service_orders` table to make `vehicle_id` nullable
    - This allows creating service orders without assigning a vehicle
  
  2. Rationale
    - Not all services require a vehicle (e.g., walk-in customers, services without vehicle data)
    - Provides flexibility in order creation workflow
*/

-- Make vehicle_id nullable in service_orders
ALTER TABLE service_orders 
ALTER COLUMN vehicle_id DROP NOT NULL;