-- Create conversations table
create table conversations (
  id            bigserial primary key,
  session_id    text not null,
  visitor_email text,
  visitor_ip    text,
  status        text not null default 'active',
  embed_origin  text,
  started_at    timestamptz not null default now(),
  closed_at     timestamptz,
  created_at    timestamptz not null default now()
);

-- Create messages table
create table messages (
  id              bigserial primary key,
  conversation_id bigint not null references conversations(id) on delete cascade,
  role            text not null,
  content         text not null,
  created_at      timestamptz not null default now()
);

-- Create escalations table
create table escalations (
  id              bigserial primary key,
  conversation_id bigint not null references conversations(id) on delete cascade,
  status          text not null default 'pending',
  notified_at     timestamptz,
  answered_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- Create knowledge_sources table
create table knowledge_sources (
  id                bigserial primary key,
  type              text not null,
  title             text not null,
  source_path       text not null unique,
  last_ingested_at  timestamptz,
  created_at        timestamptz not null default now()
);

-- Create indexes for performance
create index idx_conversations_session_id on conversations(session_id);
create index idx_conversations_status on conversations(status);
create index idx_messages_conversation_id on messages(conversation_id);
create index idx_escalations_conversation_id on escalations(conversation_id);
create index idx_escalations_status on escalations(status);

-- Enable Row Level Security
alter table conversations enable row level security;
alter table messages enable row level security;
alter table escalations enable row level security;
alter table knowledge_sources enable row level security;

-- RLS Policies: Deny all public access (service role bypasses RLS anyway)

create policy "Deny public: conversations"
  on conversations for all using (false) with check (false);

create policy "Deny public: messages"
  on messages for all using (false) with check (false);

create policy "Deny public: escalations"
  on escalations for all using (false) with check (false);

create policy "Deny public: knowledge_sources"
  on knowledge_sources for all using (false) with check (false);
