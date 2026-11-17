// Scale-up India — Phase 18: Dedicated E2E Test Fixture Endpoint
// Path: src/app/api/v1/test/fixture/route.ts
// Strictly disabled in production

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { registerUser, loginUser } from "@/domains/auth/service";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { action, sql, params, role, prefix, password = "Password@123" } = body;

    // 1. Direct SQL Query via server's internal DB handle
    if (action === "query") {
      const res = await query(sql, params || []);
      return NextResponse.json({ success: true, rows: res.rows, rowCount: res.rowCount });
    }

    // 2. Seed an authenticated user with designated role and return active sessionToken
    if (action === "seed_actor") {
      const uniqueId = crypto.randomUUID().slice(0, 8);
      const email = `playwright.${prefix || "actor"}.${role?.toLowerCase() || "user"}.${uniqueId}@scaleupindia.co.in`;

      const regRole = role === "PROMOTER" ? "PROMOTER" : "BUYER";
      const reg = await registerUser({
        email,
        firstName: `E2E_${role}`,
        lastName: uniqueId,
        password,
        roles: [regRole],
      });

      const userId = reg.user.id;

      // Assign non-default role if required
      if (role && role !== regRole) {
        const roleCode = role === "REVIEWER" ? "DUE_DILIGENCE" : role;
        const rRes = await query<{ id: string }>(`SELECT id FROM roles WHERE code = $1`, [roleCode]);
        if (rRes.rows[0]) {
          await query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, rRes.rows[0].id]
          );
        }
      }

      // Log in to obtain valid session token
      const loginRes = await loginUser({ email, password });

      return NextResponse.json({
        success: true,
        user: loginRes.user,
        sessionToken: loginRes.sessionToken,
        email,
        password,
      });
    }

    // 3. Login existing user and return session token
    if (action === "login") {
      const loginRes = await loginUser({ email: body.email, password: body.password || "Password@123" });
      return NextResponse.json({
        success: true,
        user: loginRes.user,
        sessionToken: loginRes.sessionToken,
      });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
