const { signSession } = require("./test-sign.js");

async function main() {
  const secret = process.env.SESSION_SECRET || "93cdc0093e5c3ff2636adfae6fc7ba82e51c7c2731250ed201ec930a4821ef9b";
  const { signSession } = await import("../src/lib/auth/session");

  const token = await signSession({
    sub: "user-1015",
    role: "institution",
    name: "SARAVANAN-PRIN",
    tenant: "uni-tntu",
    college: "COL-1015",
    mfa: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, secret);

  const res = await fetch("http://localhost:3000/api/v1/academic-calendar", {
    headers: { Cookie: `ciq_session=${token}` }
  });

  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));
}

main().catch(console.error);
