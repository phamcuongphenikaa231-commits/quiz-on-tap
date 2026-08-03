"use client";

import { AlertOctagon, RotateCcw } from "lucide-react";

export interface RowErrorItem {
  row: number;
  field: string;
  message: string;
}

interface ImportErrorListProps {
  errors: RowErrorItem[];
  onReset: () => void;
}

export function ImportErrorList({ errors, onReset }: ImportErrorListProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertOctagon className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-base">
              Phát hiện {errors.length} lỗi trong dữ liệu nhập
            </h3>
            <p className="text-xs text-red-700 mt-1">
              Toàn bộ lần nhập đã bị từ chối để đảm bảo tính toàn vẹn dữ liệu. Vui lòng sửa lại các dòng bên dưới và tải lên lại.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-800 hover:bg-red-100 transition-colors shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
          Tải file khác để thử lại
        </button>
      </div>

      {/* Errors Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/40 font-bold text-sm text-foreground">
          Danh sách chi tiết các dòng gặp lỗi ({errors.length})
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase border-b">
              <tr>
                <th className="px-4 py-3 w-16 text-center">Dòng</th>
                <th className="px-4 py-3 w-40">Cột / Trường</th>
                <th className="px-4 py-3">Lý do lỗi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {errors.map((err, idx) => (
                <tr key={idx} className="hover:bg-red-50/40 transition-colors">
                  <td className="px-4 py-3 text-center font-bold text-red-600 bg-red-50/30">
                    {err.row > 0 ? `Dòng ${err.row}` : "Header"}
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground font-semibold">
                    {err.field}
                  </td>
                  <td className="px-4 py-3 text-red-700 font-medium">
                    {err.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
