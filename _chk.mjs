import * as dotenv from "dotenv";
dotenv.config({ path: "backend/.env" });
const sid = process.env.TWILIO_ACCOUNT_SID;
const auth = "Basic " + Buffer.from(`${process.env.TWILIO_API_KEY_SID}:${process.env.TWILIO_API_KEY_SECRET}`).toString("base64");
for (const m of ["SM792a3911cda6a0011d09dbfbca7be429", "SMbbe5dc987aeca61652add163b3ef10da"]) {
  const d = await (await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages/${m}.json`, { headers: { Authorization: auth } })).json();
  console.log(d.to, "->", d.status, "| error:", d.error_code ?? "none", d.error_message ?? "");
}
// template approval status
for (const c of ["HXe2476903755df4a1e3e7add9dae4c578", "HX6203870dd9bc614c1dd8471398cf840a"]) {
  const d = await (await fetch(`https://content.twilio.com/v1/Content/${c}/ApprovalRequests`, { headers: { Authorization: auth } })).json();
  console.log("template", c.slice(0,8)+"…", "approval:", d.whatsapp?.status ?? JSON.stringify(d).slice(0,120));
}
