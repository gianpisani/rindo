-- Per-person chart definitions. Apply separately from the local UI preview.
begin;
create table public.analysis_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'Mis gráficos',
  layout jsonb not null default '{"desktop":[],"mobile":[]}',
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  check(jsonb_typeof(layout)='object')
);
create table public.analysis_blocks (
  id uuid primary key,
  board_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  spec jsonb not null check(jsonb_typeof(spec)='object' and spec->>'v'='1'),
  title_override text not null default '' check(length(title_override)<=120),
  position integer not null default 0,
  foreign key(board_id,user_id) references public.analysis_boards(id,user_id) on delete cascade
);
create index analysis_blocks_board_idx on public.analysis_blocks(board_id);
alter table public.analysis_boards enable row level security;
alter table public.analysis_blocks enable row level security;
create policy own_boards on public.analysis_boards for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_blocks on public.analysis_blocks for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create function public.read_analysis_board() returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',b.id,'revision',b.revision,'layouts',b.layout,'blocks',coalesce((
    select jsonb_agg(jsonb_build_object('id',x.id,'title',x.title_override,'spec',x.spec) order by x.position)
    from public.analysis_blocks x where x.board_id=b.id
  ),'[]'::jsonb)) from public.analysis_boards b where b.user_id=auth.uid();
$$;
create function public.save_analysis_board(payload jsonb,expected_revision integer) returns integer language plpgsql security invoker set search_path='' as $$
declare bid uuid; rev integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(payload->'blocks') is distinct from 'array' or jsonb_array_length(payload->'blocks')>100 or octet_length(payload::text)>1000000 then raise exception 'invalid board'; end if;
  insert into public.analysis_boards(id,user_id) values((payload->>'id')::uuid,auth.uid()) on conflict(user_id) do nothing;
  select id,revision into bid,rev from public.analysis_boards where user_id=auth.uid() for update;
  if rev<>expected_revision then raise exception 'revision conflict'; end if;
  update public.analysis_boards set layout=payload->'layouts',revision=rev+1,updated_at=now() where id=bid;
  delete from public.analysis_blocks where board_id=bid;
  insert into public.analysis_blocks(id,board_id,user_id,spec,title_override,position)
    select (item->>'id')::uuid,bid,auth.uid(),item->'spec',coalesce(item->>'title',''),ord::integer
    from jsonb_array_elements(payload->'blocks') with ordinality as t(item,ord);
  return rev+1;
end;
$$;
revoke all on function public.read_analysis_board() from public,anon;
revoke all on function public.save_analysis_board(jsonb,integer) from public,anon;
grant execute on function public.read_analysis_board() to authenticated;
grant execute on function public.save_analysis_board(jsonb,integer) to authenticated;
grant select,insert,update,delete on public.analysis_boards,public.analysis_blocks to authenticated;
commit;
