import ExcelJS from 'exceljs';
import type { AppealReport, ReportExporter } from '../../application/ports/ReportExporter.js';
import { dayKey, formatDateTime } from '../../shared/time.js';

const VISITOR = { xodim: 'Xodim', talaba: 'Talaba', mehmon: 'Mehmon' } as const;
const CHANNEL = { offline: 'Offline (shaxsan)', telefon: 'Online — Telefon', telegram: 'Online — Telegram' } as const;
const STATUS = { hal_qilindi: 'Hal qilindi', hal_qilinmadi: 'Hal qilinmadi' } as const;
const ROLE = { superadmin: 'Superadmin', markaz_boshligi: 'Markaz boshlig\'i', bolim_boshligi: 'Bo\'lim boshlig\'i', xodim: 'Xodim' } as const;

function styleHeader(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF256ABF' } };
  row.alignment = { vertical: 'middle' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

export class ExcelReportExporter implements ReportExporter {
  async toXlsx(report: AppealReport): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ADU ATM';
    wb.created = new Date();

    const list = wb.addWorksheet('Murojaatlar');
    list.columns = [
      { header: '№', key: 'n', width: 6 },
      { header: 'Sana va vaqt', key: 'date', width: 18 },
      { header: 'Murojaat nomi', key: 'title', width: 36 },
      ...(report.fields.visitorTypeEnabled ? [{ header: 'Toifa', key: 'type', width: 10 }] : []),
      ...(report.fields.channelEnabled ? [{ header: 'Murojaat turi', key: 'channel', width: 20 }] : []),
      ...(report.fields.appealStatusEnabled ? [{ header: 'Holat', key: 'status', width: 15 }] : []),
      { header: 'Qabul qilgan xodim', key: 'staff', width: 28 },
      { header: 'Bo\'lim', key: 'department', width: 24 },
      { header: 'Izoh', key: 'comment', width: 50 },
    ];
    report.appeals.forEach((a, i) =>
      list.addRow({
        n: i + 1,
        date: formatDateTime(a.createdAt),
        title: a.title,
        type: a.visitorType ? VISITOR[a.visitorType] : '',
        channel: a.channel ? CHANNEL[a.channel] : '',
        status: a.status ? STATUS[a.status] : '',
        staff: a.staffName,
        department: a.departmentName,
        comment: a.comment ?? '',
      }),
    );
    styleHeader(list);

    const staff = wb.addWorksheet('Xodimlar kesimida');
    staff.columns = [
      { header: 'Xodim', key: 'name', width: 30 },
      { header: 'Lavozim', key: 'role', width: 18 },
      { header: 'Bo\'lim', key: 'department', width: 24 },
      { header: 'Jami', key: 'total', width: 10 },
      ...(report.fields.channelEnabled
        ? [
            { header: 'Offline', key: 'offline', width: 10 },
            { header: 'Online', key: 'online', width: 10 },
          ]
        : []),
      ...(report.fields.appealStatusEnabled ? [{ header: 'Hal qilindi', key: 'resolved', width: 12 }] : []),
    ];
    for (const r of report.staffRows) {
      staff.addRow({
        name: r.fullName,
        role: ROLE[r.role],
        department: r.departmentName ?? '',
        total: r.total,
        offline: r.offline,
        online: r.online,
        resolved: r.resolved,
      });
    }
    const sum = (k: 'total' | 'offline' | 'online' | 'resolved') => report.staffRows.reduce((s, r) => s + r[k], 0);
    staff.addRow({ name: 'JAMI', total: sum('total'), offline: sum('offline'), online: sum('online'), resolved: sum('resolved') }).font = { bold: true };
    styleHeader(staff);

    const lastDay = dayKey(new Date(report.range.to.getTime() - 1));
    staff.addRow([]);
    staff.addRow([`Davr: ${dayKey(report.range.from)} — ${lastDay} (${report.title})`]);

    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
