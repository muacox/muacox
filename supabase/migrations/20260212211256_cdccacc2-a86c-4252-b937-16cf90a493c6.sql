
-- Make pdf_products publicly readable
DROP POLICY IF EXISTS "Anyone can view approved products" ON public.pdf_products;
CREATE POLICY "Anyone can view approved products" 
ON public.pdf_products 
FOR SELECT 
USING (status = 'approved' OR auth.uid() = user_id);

-- Allow authenticated users to insert their own products
DROP POLICY IF EXISTS "Users can create products" ON public.pdf_products;
CREATE POLICY "Users can create products" 
ON public.pdf_products 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own products
DROP POLICY IF EXISTS "Users can update own products" ON public.pdf_products;
CREATE POLICY "Users can update own products" 
ON public.pdf_products 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Allow admins to update any product (for approval)
DROP POLICY IF EXISTS "Admins can update any product" ON public.pdf_products;
CREATE POLICY "Admins can update any product" 
ON public.pdf_products 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

-- Make pdf_purchases accessible
DROP POLICY IF EXISTS "Users can view own purchases" ON public.pdf_purchases;
CREATE POLICY "Users can view own purchases" 
ON public.pdf_purchases 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create purchases" ON public.pdf_purchases;
CREATE POLICY "Users can create purchases" 
ON public.pdf_purchases 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Make pdf-products storage bucket public for reading
UPDATE storage.buckets SET public = true WHERE id = 'pdf-products';

-- Storage policies for pdf-products
DROP POLICY IF EXISTS "Anyone can view pdf products files" ON storage.objects;
CREATE POLICY "Anyone can view pdf products files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'pdf-products');

DROP POLICY IF EXISTS "Users can upload pdf products" ON storage.objects;
CREATE POLICY "Users can upload pdf products" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'pdf-products' AND auth.uid()::text = (storage.foldername(name))[1]);
