import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import axios from "axios";
import { HttpsProxyAgent } from "http-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import speedTest from "speedtest-net";

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/check", async (req, res) => {
  const { type, ip, port, username, password } = req.body;

  if (!["http", "socks5"].includes(type)) {
    return res.status(400).json({ error: "Invalid proxy type" });
  }

  const proxyAuth = username && password ? `${username}:${password}@` : "";
  const proxyUrl = `${type}://${proxyAuth}${ip}:${port}`;

  let agent;
  try {
    agent = type === "http"
      ? new HttpsProxyAgent(proxyUrl)
      : new SocksProxyAgent(proxyUrl);
  } catch (error) {
    return res.status(500).json({ error: "Failed to create proxy agent" });
  }

  // الخطوة 1: اختبار البروكسي
  try {
    await axios.get("http://example.com", {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 5000
    });
  } catch (err) {
    return res.json({ up: false, reason: "Proxy connection failed" });
  }

  // الخطوة 2: اختبار الاتصال بالإنترنت
  let geoData = {};
  try {
    const ipRes = await axios.get("https://ipapi.co/json/", {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 5000
    });
    geoData = {
      ip: ipRes.data.ip,
      isp: ipRes.data.org,
      country: ipRes.data.country_name,
      state: ipRes.data.region
    };
  } catch (err) {
    return res.json({ up: true, internet: false, reason: "No internet access through proxy" });
  }

  // الخطوة 3: قياس السرعة
  let speedMbps = null;
  try {
    const result = await speedTest({ acceptLicense: true, proxy: proxyUrl });
    speedMbps = (result.download.bandwidth * 8 / 1e6).toFixed(2); // بالميغابت
  } catch (err) {
    speedMbps = "Unknown";
  }

  res.json({
    up: true,
    internet: true,
    speedMbps,
    ...geoData
  });
});

app.get("/", (req, res) => {
  res.send("Proxy Checker API is running.");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
