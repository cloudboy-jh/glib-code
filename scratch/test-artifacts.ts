const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!token) {
  throw new Error("Missing CLOUDFLARE_API_TOKEN");
}

if (!accountId) {
  throw new Error("Missing CLOUDFLARE_ACCOUNT_ID");
}

const repoName = `gittrix-smoke-test-${Date.now()}`;
const baseUrl = "https://artifacts.cloudflare.net/v1/api/namespaces/default/repos";

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "X-Auth-Account-Id": accountId,
};

const createRes = await fetch(baseUrl, {
  method: "POST",
  headers,
  body: JSON.stringify({ name: repoName }),
});

const createText = await createRes.text();

console.log("CREATE STATUS:", createRes.status, createRes.statusText);
console.log("CREATE RESPONSE:");
console.log(createText);

if (createRes.ok) {
  const getRes = await fetch(`${baseUrl}/${encodeURIComponent(repoName)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Auth-Account-Id": accountId,
    },
  });

  const getText = await getRes.text();
  console.log("GET STATUS:", getRes.status, getRes.statusText);
  console.log("GET RESPONSE:");
  console.log(getText);
}
