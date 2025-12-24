import { Request, Response } from 'express';
import { EventModel } from '../models/Event.js';

function extractApplication(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  return (
    (typeof d.application === 'string' ? d.application : undefined) ||
    (typeof d.app === 'string' ? d.app : undefined) ||
    (typeof d.appName === 'string' ? d.appName : undefined) ||
    (typeof d.app_name === 'string' ? d.app_name : undefined) ||
    (typeof d.title === 'string' && d.title.includes(' - ')
      ? d.title.split(' - ')[0]
      : undefined)
  );
}

function toIsoOrEmpty(value: unknown): string {
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString();
}

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
      toIsoOrEmpty(i.timestamp as any),
      i.username || '',
      i.department || '',
      extractApplication(i.data) || '',
      i.domain || '',
      i.type || '',
      (i.durationMs as any) ?? '',
      JSON.stringify(i.data ?? {}),
    ]
      .map((v) => '"' + String(v).replace(/"/g, '""') + '"')
      .join(','))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  const filename = `activity-export-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(header + rows + (rows ? '\n' : ''));
}
