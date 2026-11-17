import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/lib/errors";

export function apiSuccess<T>(data: T, status = 200, meta?: Record<string, any>) {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    },
    { status }
  );
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const field = issue.path.join(".");
      fieldErrors[field] = issue.message;
    }
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Please correct the highlighted fields.",
          fields: fieldErrors,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 422 }
    );
  }

  if (error instanceof DomainError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: error.statusCode }
    );
  }

  // Unhandled internal server error (never leak stack trace in response)
  console.error("[INTERNAL_SERVER_ERROR]", error);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status: 500 }
  );
}

