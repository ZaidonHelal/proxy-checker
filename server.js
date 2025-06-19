const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { HttpProxy, SocksProxy, ProxyChecker } = require('free-proxy-checker');
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent'); // تأكد من تثبيت النسخة الصحيحة
const { HttpsProxyAgent } = require('https-proxy-agent');
const speedTest = require('speedtest-net');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/check', async (req, res) => {
  const { type, ip, port, username, password } = req.body;
  const auth = username && password ? { username, password } : null;

  let proxy;
  if (type === 'http') {
    proxy = new HttpProxy(ip, port, auth);
  } else if (type === 'socks5') {
    proxy = new SocksProxy(ip, port, auth, 5);
  } else {
    return res.status(400).json({ error: 'Unsupported proxy type. Use http or socks5 only.' });
  }

  const checker = new ProxyChecker([proxy], { timeout: 5000, concurrency: 1 });
  await checker.checkProxies();
  const up = checker.getProxiesUp().length === 1;

  if (!up) {
    return res.json({ up: false, reason: "Proxy server not reachable." });
  }

  // Proxy is up, test internet connectivity
  const proxyUrl = `${type}://${username && password ? `${username}:${password}@` : ''}${ip}:${port}`;
  let agent;

  try {
    agent = type === 'http'
      ? new HttpsProxyAgent(proxyUrl)
      : new SocksProxyAgent(proxyUrl);

    const response = await axios.get('https://api.ipify.org?format=json', {
      httpsAgent: agent,
      timeout: 7000
    });

    const proxyIp = response.data.ip;

    // Get geo info
    const geo = await axios.get(`https://ipapi.co/${proxyIp}/json/`);
    const { country_name, region, org } = geo.data;

    // Run speed test (limited to 5 MB)
    const speed = await speedTest({ maxTime: 15000 });
    const download = (speed.download.bandwidth * 8) / 1_000_000; // Mbps
    const upload = (speed.upload.bandwidth * 8) / 1_000_000;     // Mbps

    res.json({
      up: true,
      internet: true,
      ip: proxyIp,
      isp: org || 'Unknown',
      country: country_name || 'Unknown',
      region: region || 'Unknown',
      downloadSpeedMBps: download.toFixed(2),
      uploadSpeedMBps: upload.toFixed(2)
    });

  } catch (err) {
    return res.json({
      up: true,
      internet: false,
      reason: "Connected to proxy but unable to access the internet.",
      error: err.message
    });
  }
});

app.get("/", (req, res) => {
  res.send("Proxy Checker Server is running.");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
