export const TEAMS = [
  { id: "pss_offensive", name: "PSS Offensive" },
  { id: "pss_defensive", name: "PSS Defensive" },
  { id: "pss_ops", name: "PSS Ops" },
  { id: "pss_product", name: "PSS Product Development" },
] as const;

export type TeamId = (typeof TEAMS)[number]["id"];

export const isTeamId = (value: string | null | undefined): value is TeamId =>
  TEAMS.some((team) => team.id === value);

export const teamName = (teamId: string | null | undefined): string =>
  TEAMS.find((team) => team.id === teamId)?.name || "Unassigned";
