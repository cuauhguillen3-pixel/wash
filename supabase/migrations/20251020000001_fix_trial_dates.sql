
DO $$
BEGIN
  -- Update existing companies that are in trial mode but have invalid dates
  UPDATE companies 
  SET 
    subscription_status = 'trialing',
    subscription_end_date = NOW() + interval '30 days'
  WHERE 
    subscription_status = 'trialing' 
    AND (subscription_end_date IS NULL OR subscription_end_date < NOW());

  -- Also handle cases where subscription_status might be null (though previous migration set default)
  UPDATE companies 
  SET 
    subscription_status = 'trialing',
    subscription_end_date = NOW() + interval '30 days'
  WHERE 
    subscription_status IS NULL;
END $$;
