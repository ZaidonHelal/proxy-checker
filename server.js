import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { HttpProxy, SocksProxy, ProxyChecker } from 'free-proxy-checker';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import axios from 'axios';
import speedTest from 'speedtest-net';

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/check', async (req, res) => {
  const { type, ip, port, username, password } = req.body;

  let proxyUrl;
  if (username && password) {
    proxyUrl = `${type}://${username}:${password}@${ip}:${port}`;
  } else {
    proxyUrl = `${type}://${ip}:${port}`;
  }

  // إنشاء الكائن المناسب حسب نوع البروكسي
  let proxy;
  const auth = username && password ? { username, password } : null;
  if (type === 'http') {
    proxy = new HttpProxy(ip, port, auth);
  } else if (type === 'socks5') {
    proxy = new SocksProxy(ip, port, auth, 5);
  } else {
    return res.status(400).json({ error: 'Proxy type not supported. Use http or socks5 only.' });
  }

  const checker = new ProxyChecker([proxy], { timeout: 7000, concurrency: 1 });
  await checker.checkProxies();
  const up = checker.getProxiesUp().length === 1;

  if (!up) {
    return res.json({ up: false, error: "Proxy not responding" });
  }

  // استخدام البروكسي لاختبار الاتصال الفعلي بالإنترنت
  let agent;
  try {
    agent =
      type === 'http'
        ? new HttpProxyAgent(proxyUrl)
        : new SocksProxyAgent(proxyUrl);

    const testResponse = await axios.get('https://api.ipify.org?format=json', {
      httpsAgent: agent,
      timeout: 8000,
    });

    const ip = testResponse.data.ip;

    // احضار معلومات الموقع
    const geo = await axios.get(`https://ipapi.co/${ip}/json/`);
    const { country_name, region, org } = geo.data;

    // اختبار سرعة التحميل والتنزيل
    const result = await speedTest({ acceptLicense: true, acceptGdpr: true });

    const downloadMbps = (result.download.bandwidth * 8) / 1e6;
    const uploadMbps = (result.upload.bandwidth * 8) / 1e6;

    res.json({
      up: true,
      internet: true,
      ip,
      isp: org,
      country: country_name,
      state: region,
      download: `${downloadMbps.toFixed(2)} Mbps`,
      upload: `${uploadMbps.toFixed(2)} Mbps`,
    });

  } catch (err) {
    res.json({
      up: true,
      internet: false,
      error: "Proxy connects but cannot access internet",
    });
  }
});

app.get("/", (req, res) => {
  res.send("Proxy Full Checker is running.");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
