create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  role text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  display_name text,
  username text unique,
  bio text,
  services_offered text,
  avatar_url text,
  country text,
  skills text[] default '{}',
  hourly_rate_display numeric,
  is_employer boolean not null default true,
  is_freelancer boolean not null default true,
  reputation_score numeric default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles add column if not exists services_offered text;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text not null,
  category text,
  skills_required text[] default '{}',
  budget_type text not null default 'streaming',
  budget_min numeric,
  budget_max numeric,
  rate_per_second_mon numeric,
  deposit_target_mon numeric,
  status text not null default 'open',
  visibility text not null default 'public',
  selected_application_id uuid,
  escrow_job_id bigint,
  escrow_contract_address text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  freelancer_user_id uuid not null references public.users(id) on delete cascade,
  cover_letter text not null,
  proposed_terms text,
  proposed_rate_mon numeric,
  status text not null default 'submitted',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(job_id, freelancer_user_id)
);

create table if not exists public.engagements (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  employer_user_id uuid not null references public.users(id) on delete cascade,
  freelancer_user_id uuid not null references public.users(id) on delete cascade,
  application_id uuid not null references public.job_applications(id) on delete cascade,
  escrow_job_id bigint,
  escrow_contract_address text,
  status text not null default 'selected',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  escrow_job_id bigint not null unique,
  raised_by_user_id uuid references public.users(id) on delete set null,
  raised_by_role text,
  status text not null default 'opened',
  summary text,
  freelancer_claim text,
  employer_claim text,
  freelancer_evidence_submitted boolean not null default false,
  employer_evidence_submitted boolean not null default false,
  open_for_jury boolean not null default false,
  expires_at timestamptz,
  finalized_at timestamptz,
  final_freelancer_percent integer,
  final_employer_percent integer,
  final_reasoning text,
  resolution_tx_hash text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.disputes add column if not exists raised_by_role text;
alter table public.disputes add column if not exists freelancer_evidence_submitted boolean not null default false;
alter table public.disputes add column if not exists employer_evidence_submitted boolean not null default false;
alter table public.disputes add column if not exists open_for_jury boolean not null default false;
alter table public.disputes add column if not exists expires_at timestamptz;
alter table public.disputes add column if not exists finalized_at timestamptz;

create table if not exists public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  submitted_by_user_id uuid references public.users(id) on delete set null,
  side text not null,
  evidence_type text not null default 'text',
  content_text text,
  file_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.jurors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  wallet_address text not null,
  is_active boolean not null default true,
  expertise_tags text[] default '{}',
  reputation_score numeric default 0,
  cases_served integer not null default 0,
  last_selected_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.dispute_jurors (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  juror_user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'assigned',
  assigned_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  unique(dispute_id, juror_user_id)
);

create table if not exists public.juror_votes (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  juror_user_id uuid not null references public.users(id) on delete cascade,
  freelancer_percent integer not null,
  employer_percent integer not null,
  reasoning text,
  submitted_at timestamptz not null default timezone('utc', now()),
  unique(dispute_id, juror_user_id)
);

create or replace trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

create or replace trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace trigger jobs_set_updated_at
before update on public.jobs
for each row
execute function public.set_updated_at();

create or replace trigger job_applications_set_updated_at
before update on public.job_applications
for each row
execute function public.set_updated_at();

create or replace trigger engagements_set_updated_at
before update on public.engagements
for each row
execute function public.set_updated_at();

create or replace trigger disputes_set_updated_at
before update on public.disputes
for each row
execute function public.set_updated_at();

create or replace trigger jurors_set_updated_at
before update on public.jurors
for each row
execute function public.set_updated_at();

alter table public.users disable row level security;
alter table public.profiles disable row level security;
alter table public.jobs disable row level security;
alter table public.job_applications disable row level security;
alter table public.engagements disable row level security;
alter table public.disputes disable row level security;
alter table public.dispute_evidence disable row level security;
alter table public.jurors disable row level security;
alter table public.dispute_jurors disable row level security;
alter table public.juror_votes disable row level security;

create table if not exists public.on_chain_credentials (
  id uuid primary key default gen_random_uuid(),
  credential_id bigint not null unique,
  tx_hash text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.on_chain_credentials disable row level security;
