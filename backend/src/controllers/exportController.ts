import { Request, Response } from 'express';
import { EventModel } from '../models/Event.js';

export async function exportJSON(req: Request, res: Response) {
  const filter: Record<string, unknown> = {};
  if (req.query.user) filter.username = req.query.user;
  if (req.query.domain) filter.domain = req.query.domain;
  const items = await EventModel.find(filter).lean();
  return res.json({ items });
}

export async function exportCSV(req: Request, res: Response) {
  const filter: Record<string, unknown> = {};
  if (req.query.user) filter.username = req.query.user;
  if (req.query.domain) filter.domain = req.query.domain;
  const items = await EventModel.find(filter).lean();
  const header = 'time,user,department,application,domain,type,duration,details\n';
  const rows = items
    .map((i: any) => [
      new Date(i.time as any).toISOString(),
      i.username || '',
      i.department || '',
      i.application || '',
      i.domain || '',
      i.type || '',
      (i.duration as any) ?? '',
      JSON.stringify(i.details ?? {}),
    ]
      .map((v) => '"' + String(v).replace(/"/g, '""') + '"')
      .join(','))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  const filename = `activity-export-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(header + rows + (rows ? '\n' : ''));
}


