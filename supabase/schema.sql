-- Nexus Database Schema
-- Run this in your Supabase SQL Editor to create the necessary tables

-- Products
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  description text,
  created_at timestamp with time zone default now(),
  created_by uuid references auth.users(id)
);

-- Modules
create table if not exists modules (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references products(id) on delete cascade not null,
  name text not null,
  type text check (type in ('instruction', 'error')) not null,
  description text,
  created_at timestamp with time zone default now()
);

-- Knowledge Items
create table if not exists knowledge_items (
  id uuid default gen_random_uuid() primary key,
  module_id uuid references modules(id) on delete cascade not null,
  title text not null,
  type text check (type in ('instruction', 'error')) not null,
  content jsonb not null,
  keywords text[] default '{}',
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes
create index if not exists idx_modules_product_id on modules(product_id);
create index if not exists idx_knowledge_items_module_id on knowledge_items(module_id);
create index if not exists idx_products_slug on products(slug);
create index if not exists idx_knowledge_items_is_active on knowledge_items(is_active);

-- Row Level Security (RLS)
alter table products enable row level security;
alter table modules enable row level security;
alter table knowledge_items enable row level security;

-- Policies: Allow authenticated users full access
create policy "Authenticated users can manage products" on products
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users can manage modules" on modules
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users can manage knowledge_items" on knowledge_items
  for all using (auth.role() = 'authenticated');
