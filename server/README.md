# Supabase Backend Setup Guide 🚀

Maptivity uses [Supabase](https://supabase.com) as its Backend-as-a-Service (BaaS) for secure authentication and database management. It handles user sign-ups, logins, social OAuth, and stores user profiles.

This guide explains exactly how to set up a new Supabase project and connect it to this codebase.

---

## 1. Create a Supabase Project

1. Go to [database.new](https://database.new) and create an account or sign in.
2. Click **"New Project"**.
3. Select an organization, give your project a name (e.g., `Maptivity`), and generate a strong secure database password.
4. Choose the region closest to your users.
5. Click **"Create new project"**.
   *Note: It takes about ~2-3 minutes for the database to finish provisioning.*

---

## 2. Get Your API Keys

While your database is setting up, you can get the API keys needed to connect the frontend to Supabase.

1. In your Supabase Dashboard, look at the left sidebar and click on the **⚙️ Project Settings** gear icon (usually at the bottom).
2. Under "Configuration" on the left menu, click **API**.
3. You need two pieces of information from this page:
   - **Project URL:** Looks like `https://abcdefghijklm.supabase.co`
   - **Project API Keys:** Copy the `anon` `public` key (a very long string starting with `eyJhb...`).

---

## 3. Configure Your `.env` File

Now you need to tell your Maptivity app where to find your database.

1. In the **root directory** of your `MaptivityAI` project (the folder containing `package.json`), find or create a file named `.env.local` (or `.env`).
2. Add the two keys you just copied exactly like this:

```env
VITE_SUPABASE_URL=YOUR_PROJECT_URL_HERE
VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY_HERE
```

*Note: The `VITE_` prefix is crucial. It tells Vite (the build tool) that these variables are safe to expose to your frontend browser code.*

---

## 4. Set Up the Database Tables & Automatic Profiles

Maptivity uses a custom `profiles` table that automatically links to Supabase's built-in authentication system. When a user signs up, we want to automatically create a profile for them to store things like their "Full Name."

1. Go back to your Supabase Dashboard.
2. On the left sidebar, click on the **SQL Editor** (`</>` icon).
3. Click **"New query"**.
4. **Copy and paste the exact SQL code below** into the editor and click **Run**:

```sql
-- 1. Create a "profiles" table to store extra user data
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  primary key (id)
);

-- 2. Enable Row Level Security (RLS) so users can only view/edit their own data
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- 3. Create a Function that automatically inserts a row into "profiles" when a new auth user signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id, 
    -- Grab the "full_name" we pass from the frontend during sign up
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 4. Create a Trigger to call that function every time auth.users gets a new insert
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

*Success! Your database is now ready to automatically handle user profiles.*

---

## 5. Configure Email Authentication Limits

Supabase's free tier only allows you to send **3 emails per hour**. During development, you will hit this limit almost immediately. Here is how to bypass it for testing:

1. In Supabase Dashboard, click **Authentication** (the users icon) on the left sidebar.
2. Under "Configuration", click **Providers**.
3. Open the **Email** settings.
4. Uncheck/Toggle OFF **"Confirm email"**. (This prevents users from getting stuck waiting for an email that won't send because of rate limits).
5. At the very bottom of the Email section, locate **Test Email Addresses**.
6. Type in a dummy domain you want to use for testing: `*@example.com`
7. Click **Save**.

Now, if you test a sign up on your local site with `john@example.com`, it will create the account instantly, bypass the email limit entirely, and seamlessly log you into the map!

---

## 6. Social Providers (Google, Apple, GitHub)

The buttons for Google, Apple, and GitHub in the login UI are fully wired up in `AuthOverlay.tsx`. To make them actually work:

1. Go to **Authentication -> Providers** in Supabase.
2. Enable the social provider you want (e.g., Google).
3. Follow the instructions provided by Supabase in that window to get a Client ID and Client Secret from the provider (e.g., Google Cloud Console).
4. Enter those credentials into the Supabase window and save.
5. In your frontend, the `onClick` handler (`handleSocialAuth('google')`) will automatically redirect the user to log in!

---

**You are fully set up! Run `npm run dev` and test out your new authentication system.**
