type NamedProfile = { nickname?: string | null; full_name?: string | null } | null | undefined;

export const profileDisplayName = (profile: NamedProfile) => profile?.nickname || profile?.full_name || null;

export const initialsOf = (name: string) => name.slice(0, 2).toUpperCase();
