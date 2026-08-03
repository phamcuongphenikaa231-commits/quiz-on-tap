import { requireAdminForApi } from "@/lib/auth/require-admin";
import { jsonError } from "@/lib/api-response";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  // 1. Create Sheet 1: CauHoi
  const headers = [
    "question_text",
    "option_a",
    "explanation_a",
    "option_b",
    "explanation_b",
    "option_c",
    "explanation_c",
    "option_d",
    "explanation_d",
    "correct_answer",
    "general_explanation",
    "sort_order",
  ];

  const sampleRows = [
    {
      question_text: "Thủ đô của Việt Nam là thành phố nào?",
      option_a: "Thành phố Hồ Chí Minh",
      explanation_a: "TP.HCM là trung tâm kinh tế lớn nhất, không phải thủ đô.",
      option_b: "Hà Nội",
      explanation_b: "Hà Nội là thủ đô của Nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.",
      option_c: "Đà Nẵng",
      explanation_c: "Đà Nẵng là thành phố trực thuộc trung ương ở miền Trung.",
      option_d: "Hải Phòng",
      explanation_d: "Hải Phòng là thành phố cảng lớn ở miền Bắc.",
      correct_answer: "B",
      general_explanation: "Hà Nội trở thành thủ đô chính thức của Việt Nam từ năm 1976.",
      sort_order: 1,
    },
    {
      question_text: "Kết quả của phép tính: 15 + 27 * 2 là bao nhiêu?",
      option_a: "69",
      explanation_a: "Đúng: 27 * 2 = 54, 15 + 54 = 69 (thực hiện nhân trước, cộng sau).",
      option_b: "84",
      explanation_b: "Sai do cộng trước nhân sau ((15+27)*2 = 84).",
      option_c: "54",
      explanation_c: "Sai vì mới chỉ tính kết quả phép nhân 27 * 2.",
      option_d: "79",
      explanation_d: "Sai do tính nhầm phép cộng.",
      correct_answer: "A",
      general_explanation: "Trong toán học, thứ tự thực hiện phép tính là Nhân chia trước, Cộng trừ sau.",
      sort_order: 2,
    },
  ];

  const wsQuestions = XLSX.utils.json_to_sheet(sampleRows, { header: headers });

  // Column widths
  wsQuestions["!cols"] = [
    { wch: 40 }, // question_text
    { wch: 25 }, // option_a
    { wch: 35 }, // explanation_a
    { wch: 25 }, // option_b
    { wch: 35 }, // explanation_b
    { wch: 25 }, // option_c
    { wch: 35 }, // explanation_c
    { wch: 25 }, // option_d
    { wch: 35 }, // explanation_d
    { wch: 15 }, // correct_answer
    { wch: 45 }, // general_explanation
    { wch: 12 }, // sort_order
  ];

  // Freeze top row
  wsQuestions["!views"] = [{ state: "frozen", ySplit: 1 }];

  // 2. Create Sheet 2: HuongDan
  const guideData = [
    { Tên_cột: "question_text", Yêu_cầu: "Bắt buộc", Mô_tả: "Nội dung câu hỏi (giữ nguyên xuống dòng và Unicode tiếng Việt)." },
    { Tên_cột: "option_a", Yêu_cầu: "Bắt buộc", Mô_tả: "Nội dung phương án A." },
    { Tên_cột: "explanation_a", Yêu_cầu: "Bắt buộc", Mô_tả: "Lời giải thích riêng cho phương án A." },
    { Tên_cột: "option_b", Yêu_cầu: "Bắt buộc", Mô_tả: "Nội dung phương án B." },
    { Tên_cột: "explanation_b", Yêu_cầu: "Bắt buộc", Mô_tả: "Lời giải thích riêng cho phương án B." },
    { Tên_cột: "option_c", Yêu_cầu: "Bắt buộc", Mô_tả: "Nội dung phương án C." },
    { Tên_cột: "explanation_c", Yêu_cầu: "Bắt buộc", Mô_tả: "Lời giải thích riêng cho phương án C." },
    { Tên_cột: "option_d", Yêu_cầu: "Bắt buộc", Mô_tả: "Nội dung phương án D." },
    { Tên_cột: "explanation_d", Yêu_cầu: "Bắt buộc", Mô_tả: "Lời giải thích riêng cho phương án D." },
    { Tên_cột: "correct_answer", Yêu_cầu: "Bắt buộc", Mô_tả: "Chỉ nhận một trong các ký tự: A, B, C hoặc D (không phân biệt chữ hoa/thường)." },
    { Tên_cột: "general_explanation", Yêu_cầu: "Bắt buộc", Mô_tả: "Lời giải thích chung cho toàn bộ câu hỏi." },
    { Tên_cột: "sort_order", Yêu_cầu: "Tùy chọn", Mô_tả: "Thứ tự hiển thị (số nguyên dương). Nếu bỏ trống sẽ dùng thứ tự dòng trong file." },
  ];

  const wsGuide = XLSX.utils.json_to_sheet(guideData);
  wsGuide["!cols"] = [{ wch: 22 }, { wch: 15 }, { wch: 80 }];
  wsGuide["!views"] = [{ state: "frozen", ySplit: 1 }];

  // Assemble Workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, wsQuestions, "CauHoi");
  XLSX.utils.book_append_sheet(workbook, wsGuide, "HuongDan");

  // Generate buffer
  const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="mau-nhap-cau-hoi-quiz.xlsx"',
    },
  });
}
