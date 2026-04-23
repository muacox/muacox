-- Update existing invoice_url entries to use the secure download endpoint
UPDATE public.orders
SET invoice_url = 'https://owtcqvefxjncwunhkxdc.supabase.co/functions/v1/download-invoice/' || invoice_number || '.pdf'
WHERE invoice_number IS NOT NULL
  AND invoice_url IS NOT NULL
  AND invoice_url NOT LIKE '%/functions/v1/download-invoice/%';