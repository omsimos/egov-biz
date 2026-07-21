import { NextResponse } from "next/server";
import { mockBusinesses } from "@/lib/mock-data";

export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 650));
  return NextResponse.json({ data: mockBusinesses, mocked: true });
}
