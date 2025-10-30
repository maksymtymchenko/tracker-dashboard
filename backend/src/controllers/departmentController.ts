import { Request, Response } from 'express';
import { z } from 'zod';
import { DepartmentModel, UserDepartmentModel } from '../models/Department.js';
import { EventModel } from '../models/Event';

export async function listDepartments(_req: Request, res: Response) {
  const items = await DepartmentModel.find().lean();
  const departments = items.map((d) => ({ id: String((d as any)._id), name: d.name, color: d.color, description: d.description }));
  return res.json({ items, departments });
}

export async function createDepartment(req: Request, res: Response) {
  const schema = z.object({ id: z.string().optional(), name: z.string(), color: z.string().optional(), description: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });
  const { id, ...payload } = parsed.data;
  const dep = await DepartmentModel.create(payload);
  const department = { id: id || dep._id.toString(), name: dep.name, color: dep.color, description: dep.description };
  return res.status(201).json({ ok: true, success: true, id: dep._id.toString(), department });
}

export async function updateDepartment(req: Request, res: Response) {
  const schemaDirect = z.object({ name: z.string().optional(), color: z.string().optional(), description: z.string().optional() });
  const schemaWrapped = z.object({ updates: schemaDirect });
  const parsed = schemaWrapped.safeParse(req.body) || schemaDirect.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });
  const { id } = req.params;
  const updates: any = (parsed as any).data.updates || (parsed as any).data;
  const dep = await DepartmentModel.findByIdAndUpdate(id, updates, { new: true });
  return res.json({ ok: true, success: true, id, department: dep ? { id, name: dep.name, color: dep.color, description: dep.description } : undefined });
}

export async function deleteDepartment(req: Request, res: Response) {
  const { id } = req.params;
  await DepartmentModel.findByIdAndDelete(id);
  await UserDepartmentModel.deleteMany({ departmentId: id });
  return res.json({ ok: true, success: true, id });
}

export async function listUserDepartments(_req: Request, res: Response) {
  const items = await UserDepartmentModel.find().lean();
  const assignments = items.map((ud) => ({ username: ud.username, departmentId: String(ud.departmentId) }));
  return res.json({ items, assignments });
}

export async function assignUserDepartment(req: Request, res: Response) {
  const schema = z.object({ username: z.string(), departmentId: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });
  await UserDepartmentModel.create(parsed.data);
  return res.status(201).json({ ok: true, success: true });
}

export async function unassignUserDepartment(req: Request, res: Response) {
  const schema = z.object({ username: z.string(), departmentId: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });
  const { username, departmentId } = parsed.data;
  await UserDepartmentModel.deleteOne({ username, departmentId });
  return res.json({ ok: true, success: true });
}

export async function usersInDepartment(req: Request, res: Response) {
  const { id } = req.params;
  const items = await UserDepartmentModel.find({ departmentId: id }).lean();
  const users = items.map((u) => u.username);
  return res.json({ items, users });
}

export async function filterUsersByDepartment(req: Request, res: Response) {
  const schema = z.object({ users: z.array(z.string()), departmentId: z.string() });
  const { users, departmentId } = schema.parse(req.body);
  const set = new Set((await UserDepartmentModel.find({ departmentId }).lean()).map((u) => u.username));
  const filtered = users.filter((u) => set.has(u));
  return res.json({ items: filtered, users: filtered });
}

export async function groupUsersByDepartment(req: Request, res: Response) {
  const schema = z.object({ users: z.array(z.string()) });
  const { users } = schema.parse(req.body);
  const all = await UserDepartmentModel.find({ username: { $in: users } }).lean();
  const groups: Record<string, string[]> = {};
  all.forEach((row) => {
    const key = String(row.departmentId);
    if (!groups[key]) groups[key] = [];
    groups[key].push(row.username);
  });
  return res.json({ groups });
}

export async function departmentStats(req: Request, res: Response) {
  const { id } = req.params;
  const users = await UserDepartmentModel.find({ departmentId: id }).lean();
  const usernames = users.map((u) => u.username);
  const agg = await EventModel.aggregate([
    { $match: { username: { $in: usernames } } },
    { $group: { _id: null, events: { $sum: 1 }, duration: { $sum: { $ifNull: ['$durationMs', 0] } } } },
  ]);
  const stats = agg[0] ? { events: agg[0].events, duration: agg[0].duration } : { events: 0, duration: 0 };
  return res.json({ stats });
}

export async function searchDepartments(req: Request, res: Response) {
  const q = String((req.query.q as string) || '').toLowerCase();
  const items = await DepartmentModel.find().lean();
  const departments = items
    .map((d) => ({ id: String((d as any)._id), name: d.name, color: d.color, description: d.description }))
    .filter((d) => !q || d.name.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q));
  return res.json({ departments });
}

export async function exportDepartments(_req: Request, res: Response) {
  const items = await DepartmentModel.find().lean();
  const data = items.map((d) => ({ id: String((d as any)._id), name: d.name, color: d.color, description: d.description }));
  res.json({ departments: data });
}

export async function importDepartments(req: Request, res: Response) {
  const schema = z.object({ data: z.array(z.object({ id: z.string().optional(), name: z.string(), color: z.string().optional(), description: z.string().optional() })) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });
  const toInsert = parsed.data.data.map((d) => ({ name: d.name, color: d.color, description: d.description }));
  const result = await DepartmentModel.insertMany(toInsert, { ordered: false });
  return res.json({ success: true, count: result.length });
}


