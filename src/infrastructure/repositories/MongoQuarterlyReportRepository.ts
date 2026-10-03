import { isValidObjectId } from 'mongoose';
import type { QuarterlyReport, ReportStatus } from '../../domain/entities/QuarterlyReport.js';
import type {
  NewQuarterlyReport,
  QuarterlyReportChanges,
  QuarterlyReportRepository,
} from '../../domain/repositories/QuarterlyReportRepository.js';
import { QuarterlyReportModel, type QuarterlyReportDoc } from '../db/models/QuarterlyReportModel.js';

const str = (v: unknown) => (typeof v === 'string' ? v : '');

function toEntity(doc: QuarterlyReportDoc): QuarterlyReport {
  const h = doc.header ?? {};
  return {
    id: String(doc._id),
    departmentId: String(doc.departmentId),
    year: doc.year,
    quarter: doc.quarter,
    status: doc.status as ReportStatus,
    header: {
      approverTitle: str(h.approverTitle),
      approverName: str(h.approverName),
      centerName: str(h.centerName),
      departmentName: str(h.departmentName),
      signerTitle: str(h.signerTitle),
      signerName: str(h.signerName),
    },
    content: doc.content
      ? {
          summary: str(doc.content.summary),
          months: (doc.content.months ?? []).map((m) => ({
            month: m.month ?? 0,
            name: str(m.name),
            items: (m.items ?? []).map((i) => ({ text: i.text, sources: i.sources ?? [] })),
          })),
          extra: (doc.content.extra ?? []).map((i) => ({ text: i.text, sources: i.sources ?? [] })),
          conclusion: doc.content.conclusion ?? [],
        }
      : undefined,
    sources: (doc.sources ?? []).map((s) => ({
      ref: str(s.ref),
      kind: s.kind === 'topshiriq' ? 'topshiriq' : 'ish',
      date: s.date ?? new Date(0),
      text: str(s.text),
      author: str(s.author),
    })),
    writer: doc.writer ?? undefined,
    error: doc.error ?? undefined,
    generatedById: String(doc.generatedById),
    generatedAt: doc.generatedAt ?? undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoQuarterlyReportRepository implements QuarterlyReportRepository {
  async findById(id: string): Promise<QuarterlyReport | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await QuarterlyReportModel.findById(id).lean();
    return doc ? toEntity(doc as QuarterlyReportDoc) : null;
  }

  async find(departmentId: string, year: number, quarter: number): Promise<QuarterlyReport | null> {
    const doc = await QuarterlyReportModel.findOne({ departmentId, year, quarter }).lean();
    return doc ? toEntity(doc as QuarterlyReportDoc) : null;
  }

  async findLatestReady(): Promise<QuarterlyReport | null> {
    const doc = await QuarterlyReportModel.findOne({ status: 'ready' }).sort({ updatedAt: -1 }).lean();
    return doc ? toEntity(doc as QuarterlyReportDoc) : null;
  }

  async create(data: NewQuarterlyReport): Promise<QuarterlyReport> {
    const doc = await QuarterlyReportModel.create(data);
    return toEntity(doc.toObject() as QuarterlyReportDoc);
  }

  async update(id: string, changes: QuarterlyReportChanges): Promise<QuarterlyReport | null> {
    const { error, ...rest } = changes;
    const update = error === undefined && 'error' in changes ? { ...rest, $unset: { error: 1 } } : changes;
    const doc = await QuarterlyReportModel.findByIdAndUpdate(id, update, { new: true }).lean();
    return doc ? toEntity(doc as QuarterlyReportDoc) : null;
  }
}
