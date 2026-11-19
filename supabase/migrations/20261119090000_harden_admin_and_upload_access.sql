CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.users
  WHERE user_id = auth.uid() AND account_status = 'ACTIVE';
$$;

ALTER POLICY "uploads: lab admin can upload"
  ON public.uploads
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.current_user_role() = 'LAB_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.labs AS lab
      WHERE lab.lab_id = uploads.lab_id
        AND lab.competition_id = uploads.competition_id
        AND lab.assigned_admin_id = auth.uid()
    )
  );
