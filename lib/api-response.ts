import { NextResponse } from "next/server";

interface ErrorBody {
  ok: false;
  code: string;
  message: string;
}

interface SuccessBody<T = unknown> {
  ok: true;
  data: T;
}

export function jsonOk<T>(data: T, status = 200) {
  const body: SuccessBody<T> = { ok: true, data };
  return NextResponse.json(body, { status });
}

export function jsonError(code: string, message: string, status = 400) {
  const body: ErrorBody = { ok: false, code, message };
  return NextResponse.json(body, { status });
}
