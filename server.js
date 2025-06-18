const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { HttpProxy, SocksProxy, ProxyChecker } = require('free-proxy-checker');

const app = express();

// ✅ تفعيل الـ CORS
app.use(cors());
app.use(bodyParser.json());

app.post('/check', async (req, res) => {
  const { type, ip, port, username, password } = req.body;
  let proxy;
  const auth = username && password ? { username, password } : null;

  if (type === 'http') {
    proxy = new HttpProxy(ip, port, auth);
  } else {
    proxy = new SocksProxy(ip, port, auth, type === 'socks5' ? 5 : 4);
  }

  const checker = new ProxyChecker([proxy], { timeout: 5000, concurrency: 1 });
  await checker.checkProxies();
  const up = checker.getProxiesUp().length === 1;

  res.json({ up });
});

// ✅ صفحة رئيسية للفحص
app.get("/", (req, res) => {
  res.send("Proxy Checker Server is running.");
});

// ✅ تشغيل الخادم على المنفذ الصحيح
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
