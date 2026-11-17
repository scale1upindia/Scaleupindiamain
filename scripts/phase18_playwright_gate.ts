// Scale-up India — Phase 18: End-to-End Deal Room Playwright Journeys Automated Certification Gate
// Script: scripts/phase18_playwright_gate.ts

import { execSync } from "child_process";
import http from "http";

interface PlaywrightTestResult {
  title: string;
  status: "passed" | "failed" | "timedOut" | "skipped";
  duration: number;
}

interface PlaywrightSuite {
  title: string;
  file: string;
  specs: {
    title: string;
    ok: boolean;
    tests: {
      results: PlaywrightTestResult[];
    }[];
  }[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightReport {
  suites: PlaywrightSuite[];
  errors: any[];
  stats: {
    startTime: string;
    duration: number;
    expected: number;
    skipped: number;
    unexpected: number;
    flaky: number;
  };
}

let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, code: string, description: string): void {
  if (condition) {
    totalPassed++;
    console.log(`  [PASS] ${code}: ${description}`);
  } else {
    totalFailed++;
    console.error(`  [FAIL] ${code}: ${description}`);
  }
}

async function checkServerHealth(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function runPhase18Gate() {
  console.log("=================================================================");
  console.log("SCALE-UP INDIA — PHASE 18: PLAYWRIGHT E2E BROWSER CERTIFICATION GATE");
  console.log("=================================================================\n");

  try {
    // -------------------------------------------------------------------------
    // GATE CHECK 1: Server and Fixture Infrastructure Health
    // -------------------------------------------------------------------------
    console.log("--- SECTION 1: E2E INFRASTRUCTURE & RUNTIME READINESS ---");
    const serverHealthy = await checkServerHealth("http://localhost:3000/api/v1/test/fixture");
    assert(serverHealthy, "P18-INFRA-01", "Next.js dev server & E2E test fixture endpoint active on http://localhost:3000");

    // -------------------------------------------------------------------------
    // GATE CHECK 2: Execute Playwright E2E Suite with JSON Reporter
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION 2: EXECUTING PLAYWRIGHT BROWSER JOURNEYS (FLOW 1 - 5 & SECURITY) ---");
    console.log("Running: npx playwright test --reporter=json ...");

    let rawJson = "";
    try {
      rawJson = execSync("npx playwright test --reporter=json", {
        encoding: "utf-8",
        maxBuffer: 50 * 1024 * 1024,
      });
    } catch (err: any) {
      rawJson = err.stdout || "";
    }

    let report: PlaywrightReport;
    try {
      // Find the JSON object starting from first '{'
      const jsonStart = rawJson.indexOf("{");
      const cleanJson = rawJson.slice(jsonStart);
      report = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error("Failed to parse Playwright JSON output:", parseErr);
      console.error("Raw output was:\n", rawJson);
      process.exit(1);
    }

    assert(Boolean(report.stats), "P18-RUN-01", "Playwright report generated valid execution stats");
    assert(report.stats.unexpected === 0, "P18-RUN-02", `Zero unexpected failures (actual unexpected: ${report.stats.unexpected})`);
    assert(report.stats.flaky === 0, "P18-RUN-03", `Zero flaky test executions (actual flaky: ${report.stats.flaky})`);
    assert(report.stats.expected >= 34, "P18-RUN-04", `All 34 required E2E tests executed successfully (actual passed: ${report.stats.expected})`);

    // -------------------------------------------------------------------------
    // GATE CHECK 3: Verify Individual Journey Suite Assertions
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION 3: JOURNEY & SECURITY SUITE VERIFICATION ---");

    function collectSpecs(suite: PlaywrightSuite): { file: string; title: string; ok: boolean }[] {
      let results: { file: string; title: string; ok: boolean }[] = [];
      const file = suite.file || "";
      if (suite.specs) {
        for (const spec of suite.specs) {
          results.push({ file, title: spec.title, ok: spec.ok });
        }
      }
      if (suite.suites) {
        for (const sub of suite.suites) {
          results = results.concat(collectSpecs(sub));
        }
      }
      return results;
    }

    let allSpecs: { file: string; title: string; ok: boolean }[] = [];
    for (const topSuite of report.suites) {
      allSpecs = allSpecs.concat(collectSpecs(topSuite));
    }

    // Flow 1: Seller Onboarding -> Opportunity Draft -> Verification -> Publish -> Catalog Discovery
    const flow1Specs = allSpecs.filter((s) => s.file.includes("flow1-seller-opportunity"));
    assert(flow1Specs.length === 6, "P18-FLOW1-01", `Flow 1 contains exactly 6 journey steps (found: ${flow1Specs.length})`);
    assert(flow1Specs.every((s) => s.ok), "P18-FLOW1-02", "Flow 1 all 6 journey steps PASSED (Seller Registration -> Verification -> Publish)");

    // Flow 2: Buyer Onboarding -> Mandate -> Match -> Discovery -> Bilateral EOI -> Seller Accept
    const flow2Specs = allSpecs.filter((s) => s.file.includes("flow2-buyer-discovery-eoi"));
    assert(flow2Specs.length === 7, "P18-FLOW2-01", `Flow 2 contains exactly 7 journey steps (found: ${flow2Specs.length})`);
    assert(flow2Specs.every((s) => s.ok), "P18-FLOW2-02", "Flow 2 all 7 journey steps PASSED (Buyer Mandate -> Matching -> Bilateral EOI Acceptance)");

    // Flow 3: Bilateral Interest -> NDA Workspace -> VDR Access & Downloads -> Deal Messaging -> MOU Proposal, Counter & Acceptance
    const flow3Specs = allSpecs.filter((s) => s.file.includes("flow3-nda-vdr-messaging-mou"));
    assert(flow3Specs.length === 5, "P18-FLOW3-01", `Flow 3 contains exactly 5 journey steps (found: ${flow3Specs.length})`);
    assert(flow3Specs.every((s) => s.ok), "P18-FLOW3-02", "Flow 3 all 5 journey steps PASSED (NDA Execution -> VDR Access -> Deal Messaging -> Bilateral MOU Acceptance)");

    // Flow 4: Accepted MOU -> Payment Token Deposit -> Due Diligence Workspace & Evidence -> Reviewer Findings -> Valuation Engine & Lock
    const flow4Specs = allSpecs.filter((s) => s.file.includes("flow4-payment-diligence-valuation"));
    assert(flow4Specs.length === 4, "P18-FLOW4-01", `Flow 4 contains exactly 4 journey steps (found: ${flow4Specs.length})`);
    assert(flow4Specs.every((s) => s.ok), "P18-FLOW4-02", "Flow 4 all 4 journey steps PASSED (Earnest Token Payment -> Due Diligence Evidence & Findings -> Valuation Lock)");

    // Flow 5: Approved Valuation -> Deal Room -> Closing Conditions -> Bilateral Confirmations -> Independent Review -> Atomic Closing -> Post-Closing Immutability
    const flow5Specs = allSpecs.filter((s) => s.file.includes("flow5-transaction-closing"));
    assert(flow5Specs.length === 6, "P18-FLOW5-01", `Flow 5 contains exactly 6 journey steps (found: ${flow5Specs.length})`);
    assert(flow5Specs.every((s) => s.ok), "P18-FLOW5-02", "Flow 5 all 6 journey steps PASSED (Deal Room -> Closing Conditions -> Bilateral Confirmations -> Atomic Closing -> Immutability)");

    // Security & Roles Matrix: Multi-Tenancy, Progressive Disclosure Zero-Leakage, File Security, RBAC & Notifications
    const secSpecs = allSpecs.filter((s) => s.file.includes("security-and-roles"));
    assert(secSpecs.length === 6, "P18-SEC-01", `Security & Role Matrix contains exactly 6 assertions (found: ${secSpecs.length})`);
    assert(secSpecs.every((s) => s.ok), "P18-SEC-02", "Security & Role Matrix all 6 assertions PASSED (Cross-Tenant Isolation, Zero-Leakage Masking, File Security, RBAC)");

    // -------------------------------------------------------------------------
    // FINAL GATE REPORT SUMMARY
    // -------------------------------------------------------------------------
    console.log("\n=================================================================");
    console.log("PHASE 18 PLAYWRIGHT E2E CERTIFICATION GATE SUMMARY");
    console.log("=================================================================");
    console.log(`  TOTAL PLAYWRIGHT BROWSER TESTS: ${report.stats.expected}`);
    console.log(`  TOTAL GATE ASSERTIONS EVALUATED: ${totalPassed + totalFailed}`);
    console.log(`  PASSED ASSERTIONS:              ${totalPassed}`);
    console.log(`  FAILED ASSERTIONS:              ${totalFailed}`);
    console.log(`  TOTAL SUITE DURATION:           ${(report.stats.duration / 1000).toFixed(1)}s`);
    console.log("=================================================================\n");

    if (totalFailed > 0 || report.stats.unexpected > 0) {
      console.error(`❌ PHASE 18 PLAYWRIGHT GATE FAILED: ${totalFailed} assertions failed.`);
      process.exit(1);
    } else {
      console.log(`✅ PHASE 18 PLAYWRIGHT CERTIFICATION GATE PASSED: All 34 browser tests & ${totalPassed} gate assertions satisfied.`);
      console.log(`VERDICT: READY_FOR_PHASE_19`);
      process.exit(0);
    }
  } catch (error) {
    console.error("FATAL ERROR IN PHASE 18 PLAYWRIGHT GATE EXECUTION:", error);
    process.exit(1);
  }
}

runPhase18Gate();
