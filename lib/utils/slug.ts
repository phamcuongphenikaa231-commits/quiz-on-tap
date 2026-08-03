/**
 * Chuyển chuỗi tiếng Việt có dấu thành slug:
 *  - Bỏ dấu tiếng Việt
 *  - Chuyển khoảng trắng thành dấu gạch ngang
 *  - Chỉ giữ chữ thường, số và dấu gạch ngang
 *  - Xóa gạch ngang đầu/cuối và liên tiếp
 */
export function toSlug(text: string): string {
  let s = text.trim().toLowerCase();

  // Remove Vietnamese diacritics
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Handle special Vietnamese characters that NFD doesn't fully cover
  s = s
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/ạ|ả|ã|ầ|ấ|ậ|ẩ|ẫ|ằ|ắ|ặ|ẳ|ẵ/g, "a")
    .replace(/ẹ|ẻ|ẽ|ề|ế|ệ|ể|ễ/g, "e")
    .replace(/ị|ỉ|ĩ/g, "i")
    .replace(/ọ|ỏ|õ|ồ|ố|ộ|ổ|ỗ|ờ|ớ|ợ|ở|ỡ/g, "o")
    .replace(/ụ|ủ|ũ|ừ|ứ|ự|ử|ữ/g, "u")
    .replace(/ỳ|ỵ|ỷ|ỹ/g, "y");

  // Replace spaces and special characters with hyphens
  s = s.replace(/[^a-z0-9]+/g, "-");

  // Remove leading/trailing hyphens and collapse multiple hyphens
  s = s.replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");

  return s;
}
