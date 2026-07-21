import { NextResponse } from "next/server";
import { mockProfile } from "@/lib/mock-data";

export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 450));
  return NextResponse.json({ data: mockProfile, mocked: true });
}
