-- Private raw-file archive for lab leaderboard submissions.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('leaderboard-uploads', 'leaderboard-uploads', false, 5242880, array['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/octet-stream', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = 5242880;

create policy "leaderboard archive: admins can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'leaderboard-uploads'
  and public.current_user_role() = 'COMPETITION_ADMIN'
);
