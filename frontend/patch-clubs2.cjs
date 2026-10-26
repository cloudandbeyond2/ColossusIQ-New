const fs = require("fs");
function patch(p, fn) {
  let s = fs.readFileSync(p, "utf8");
  const nl = s.includes("\r\n") ? "\r\n" : "\n";
  s = s.replace(/\r\n/g, "\n");
  s = fn(s);
  fs.writeFileSync(p, s.replace(/\n/g, nl), "utf8");
}
const mk = (get, set) => (a, b) => { const s = get(); if (!s.includes(a)) throw new Error("missing " + a.slice(0, 70)); set(s.replace(a, () => b)); };

patch("src/lib/api/schemas.ts", (s) => {
  const r = mk(() => s, (v) => (s = v));
  r(`  isJoined: z.boolean().default(false),\n  createdAt: z.string(),`, `  isJoined: z.boolean().default(false),\n  /** Staff, or the person who started the club, may edit its details. */\n  canEdit: z.boolean().default(false),\n  createdAt: z.string(),`);
  r(`permissions: z.object({ manage: z.boolean(), remove: z.boolean() }),`, `permissions: z.object({ create: z.boolean(), manage: z.boolean(), remove: z.boolean() }),`);
  return s;
});

patch("src/lib/api/mock/clubs.ts", (s) => {
  const r = mk(() => s, (v) => (s = v));
  r(`export const canManageClubs = (role: string) => MANAGE_ROLES.has(role);`, `export const canManageClubs = (role: string) => MANAGE_ROLES.has(role);\n/** Anyone on campus except outside recruiters may start a club; staff and the club's founder can then run it. */\nexport const canCreateClubs = (role: string) => !JOIN_BLOCKED.has(role);`);
  r(`function view(c: ClubRow, joined: boolean): ClubItem {
  const { college: _c, createdBySub: _b, ...rest } = c;
  void _c;
  void _b;
  return { ...rest, isJoined: joined };
}`, `function view(c: ClubRow, joined: boolean, session: SessionPayload): ClubItem {
  const { college: _c, createdBySub, ...rest } = c;
  void _c;
  return { ...rest, isJoined: joined, canEdit: canManageClubs(session.role) || (createdBySub !== "" && createdBySub === session.sub) };
}`);
  r(`clubs.map((c) => view(c, mine.has(c.id))),
    permissions: { manage: canManageClubs(session.role), remove: canRemoveClubs(session.role) },`, `clubs.map((c) => view(c, mine.has(c.id), session)),
    permissions: { create: canCreateClubs(session.role), manage: canManageClubs(session.role), remove: canRemoveClubs(session.role) },`);
  r(`return view(created, false);`, `return view(created, true, session);`);
  r(`  await audit(session, \`Created campus club "\${created.name}" (\${created.category})\`, created.id);`, `  // the founder is its first member
  await clubsData().join(created, session.sub, session.name);
  await audit(session, \`Created campus club "\${created.name}" (\${created.category})\`, created.id);`);
  r(`  const club = await ownClub(session, clubId);
  const clean: Record<string, string> = {};`, `  const club = await ownClub(session, clubId);
  if (!canManageClubs(session.role) && !(club.createdBySub !== "" && club.createdBySub === session.sub)) {
    throw new ClubError("Only staff or the person who started this club can change it.", 403);
  }
  const clean: Record<string, string> = {};`);
  r(`  return view(updated, joined.includes(updated.id));`, `  return view(updated, joined.includes(updated.id), session);`);
  return s;
});

patch("src/lib/api/mock/router.ts", (s) => {
  const r = mk(() => s, (v) => (s = v));
  r(`import { ClubError, canManageClubs, canRemoveClubs,`, `import { ClubError, canCreateClubs, canRemoveClubs,`);
  r(`          case "POST clubs": {
            if (!canManageClubs(session.role)) return forbidden();`, `          case "POST clubs": {
            if (!canCreateClubs(session.role)) return forbidden();`);
  r(`          case "PUT clubs/:id": {
            if (!canManageClubs(session.role)) return forbidden();`, `          case "PUT clubs/:id": {
            if (!canCreateClubs(session.role)) return forbidden();`);
  return s;
});

patch("src/lib/api/mock/module-data.ts", (s) => {
  const r = mk(() => s, (v) => (s = v));
  r(`import { getCollegeClubs } from "./clubs";`, `import { clubsData } from "./clubs-data";`);
  r(`  clubs: (collegeScope) => {
    return list(`, `  clubs: async (collegeScope) => {
    const items = await clubsData().clubs(collegeScope === "all" ? ((await listColleges())[0]?.id ?? "") : collegeScope);
    return list(`);
  r(`    const items = getCollegeClubs(collegeScope);\n`, ``);
  return s;
});

patch("src/components/portal/bespoke/clubs.tsx", (s) => {
  const r = mk(() => s, (v) => (s = v));
  r(`  const canManage = query.data?.permissions.manage ?? false;`, `  const canCreate = query.data?.permissions.create ?? false;`);
  r(`  const isPrivileged = canManage;\n  void role;`, `  void role;`);
  r(`            {canManage ? (
              <Button onClick={() => setIsCreateOpen(true)}`, `            {canCreate ? (
              <Button onClick={() => setIsCreateOpen(true)}`);
  r(`          isPrivileged={isPrivileged}\n          canRemove`, `          isPrivileged={selectedClub.canEdit}\n          canRemove`);
  return s;
});
console.log("ok");
