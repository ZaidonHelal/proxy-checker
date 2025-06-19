const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { HttpProxy, SocksProxy, ProxyChecker } = require('free-proxy-checker');
const HttpsProxyAgent = require('https-proxy-agent');
const createSocksProxyAgent = require('socks-proxy-agent');
const axios = require('axios');
const speedTest = require('speedtest-net');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/check', async (req, res) => {
  try {
    const { type, ip, port, username, password } = req.body;
    const auth = username && password ? { username, password } : null;

    let proxy;
    if (type === 'http') {
      proxy = new HttpProxy(ip, port, auth);
    } else if (type === 'socks5') {
      proxy = new SocksProxy(ip, port, auth, 5);
    } else {
      return res.status(400).json({ error: 'Only http and socks5 are supported.' });
    }

    const checker = new ProxyChecker([proxy], { timeout: 5000, concurrency: 1 });
    await checker.checkProxies();
    const isUp = checker.getProxiesUp().length === 1;

    if (!isUp) {
      return res.json({ up: false, internet: false });
    }

    const proxyUrl = `${type}://${username && password ? `${username}:${password}@` : ''}${ip}:${port}`;
    const agent = type === 'http'
      ? new HttpsProxyAgent(proxyUrl)
      : createSocksProxyAgent(proxyUrl);

    let testConnection;
    try {
      testConnection = await axios.get('http://www.google.com', { httpAgent: agent, timeout: 7000 });
    } catch {
      return res.json({ up: true, internet: false });
    }

    const st = await speedTest({ proxy: proxyUrl, acceptLicense: true, acceptGdpr: true });
    const geo = await axios.get('https://ipapi.co/json', { httpAgent: agent });

    res.json({
      up: true,
      internet: true,
      download: (st.download.bandwidth / 1024).toFixed(2), // KB/s
      upload: (st.upload.bandwidth / 1024).toFixed(2),     // KB/s
      ip: geo.data.ip,
      isp: geo.data.org,
      country: geo.data.country_name,
      region: geo.data.region
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error occurred.' });
  }
});

app.get('/', (req, res) => {
  res.send('Proxy Checker API is running.');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
