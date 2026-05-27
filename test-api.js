async function main() {
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@littlesouls.com", password: "password123" }) // assuming default admin creds
  });
  if (!loginRes.ok) return console.error("Login failed", await loginRes.text());
  const { accessToken } = await loginRes.json();
  const cusRes = await fetch("http://localhost:3000/api/customer?status=APPROVED", {
    headers: { "Authorization": "Bearer " + accessToken }
  });
  const data = await cusRes.json();
  console.log(JSON.stringify(data.customers[0]?.users, null, 2));
}
main();
