export interface SessionLike {
  id: string;
  sessionId?: string;
  sessionName?: string;
}

export function formatSessionLabel(r: SessionLike): string {
  return r.sessionName ?? r.sessionId?.slice(0, 8) ?? r.id.slice(0, 8);
}
