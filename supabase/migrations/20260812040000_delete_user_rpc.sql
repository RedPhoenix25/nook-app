CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void AS $$
BEGIN
  -- Delete the user from auth.users
  -- Because our public schema uses ON DELETE CASCADE on auth.users(id),
  -- this will automatically cascade and delete the user's profile, space_members, etc.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
