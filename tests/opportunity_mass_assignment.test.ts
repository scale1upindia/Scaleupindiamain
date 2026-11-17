import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, query } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import { createOpportunity, updateOpportunity } from "@/domains/opportunity/service";
import { AuthenticatedUser } from "@/types/auth";

describe("Phase 4: Opportunity Mass-Assignment Protections", () => {
  let sellerUser: AuthenticatedUser;
  let opportunityId: string;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    const reg = await registerUser({
      email: "promoter@apexvalves.in",
      firstName: "Rajesh",
      lastName: "Sharma",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    sellerUser = reg.user;

    const opp = await createOpportunity(sellerUser, {
      title: "Engineered Ball Valves & Actuators Manufacturer",
      teaserSummary: "API-certified industrial valve manufacturing facility supplying energy and refining projects.",
      businessCategory: "MANUFACTURING",
      industry: "Industrial Machinery",
      operatingRegion: "WEST_INDIA",
      registeredState: "Maharashtra",
      approximateAgeBracket: "10_TO_20_YRS",
      revenueBracket: "50CR_TO_100CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "B2B",
    });
    opportunityId = opp.id;
  });

  it("ignores attempts to self-verify or self-publish via payload tampering", async () => {
    // Malicious payload attempting to manipulate status, reference code, sellerProfileId, verifiedBy
    await updateOpportunity(opportunityId, sellerUser, {
      title: "Legitimate Title Update",
      status: "PUBLISHED",
      referenceCode: "OPP-MALICIOUS-9999",
      verifiedBy: sellerUser.id,
      publishedAt: new Date(),
    } as any);

    // Verify in database that server-controlled fields were NOT modified
    const dbRes = await query<any>(`SELECT * FROM opportunities WHERE id = $1`, [opportunityId]);
    const row = dbRes.rows[0];

    expect(row.title).toBe("Legitimate Title Update");
    expect(row.status).toBe("DRAFT"); // Still DRAFT, not PUBLISHED!
    expect(row.reference_code).not.toBe("OPP-MALICIOUS-9999");
    expect(row.verified_by).toBeNull();
    expect(row.published_at).toBeNull();
  });
});
