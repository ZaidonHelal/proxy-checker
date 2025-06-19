const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');
const SocksProxyAgent = require('socks-proxy-agent');
const net = require('net');

const app = express();
app.use(cors());
app.use(bodyParser.json());

function calculateMBps(bytes, ms) {
  const seconds = ms / 1000;
  return (bytes / (1024 * 1024) / seconds).toFixed(2); // MB/s
}

function testProxyConnection(ip, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => resolve(false));
    socket.connect(port, ip);
  });
}

app.post('/check', async (req, res) => {
  const { type, ip, port, username, password } = req.body;

  // السماح فقط بـ http و socks5
  if (type !== 'http' && type !== 'socks5') {
    return res.status(400).json({ error: 'Only http and socks5 proxy types are supported.' });
  }

  // التحقق من استجابة سيرفر البروكسي
  const proxyIsReachable = await testProxyConnection(ip, port);
  if (!proxyIsReachable) {
    return res.json({ up: false, reason: 'Proxy server not reachable.' });
  }

  // إعداد البروكسي
  let proxyUrl;
  if (type === 'http') {
    proxyUrl = `http://${username ? `${username}:${password}@` : ''}${ip}:${port}`;
  } else {
    proxyUrl = `socks5://${username ? `${username}:${password}@` : ''}${ip}:${port}`;
  }

  const agent = type === 'socks5'
    ? new SocksProxyAgent(proxyUrl)
    : new HttpsProxyAgent(proxyUrl);

  try {
    // التحقق من وجود اتصال فعلي بالإنترنت
    const ipResponse = await axios.get('https://api.ipify.org?format=json', {
      httpsAgent: agent,
      timeout: 7000
    });

    // سرعة التحميل
    const downloadStart = Date.now();
    const response = await axios.get('https://speed.hetzner.de/5MB.bin', {
      httpsAgent: agent,
      timeout: 15000,
      responseType: 'stream',
    });

    let downloadedBytes = 0;
    await new Promise((resolve, reject) => {
      response.data.on('data', chunk => downloadedBytes += chunk.length);
      response.data.on('end', resolve);
      response.data.on('error', reject);
    });
    const downloadTime = Date.now() - downloadStart;
    const downloadSpeed = calculateMBps(downloadedBytes, downloadTime);

    // سرعة الرفع
    const uploadData = Buffer.alloc(5 * 1024 * 1024, 'a');
    const uploadStart = Date.now();
    await axios.post('https://httpbin.org/post', uploadData, {
      httpsAgent: agent,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': uploadData.length
      }
    });
    const uploadTime = Date.now() - uploadStart;
    const uploadSpeed = calculateMBps(uploadData.length, uploadTime);

    // معلومات الـ IP
    const geo = await axios.get(`http://ip-api.com/json/${ipResponse.data.ip}`);
    const { country, regionName, isp, query } = geo.data;

    res.json({
      up: true,
      internet: true,
      ip: query,
      isp,
      country,
      region: regionName,
      downloadSpeedMBps: downloadSpeed,
      uploadSpeedMBps: uploadSpeed
    });

  } catch (error) {
    return res.json({
      up: true,
      internet: false,
      reason: 'Connected to proxy but unable to access the internet.',
      error: error.message
    });
  }
});

app.get("/", (req, res) => {
  res.send("Proxy Full Checker Server is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
