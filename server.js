const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { validateMember } = require('./public/js/validation');
const { createProductHandler } = require('./lib/product-api');
const publicDirectory = path.join(__dirname, 'public');

function createServer({
  dataFile = path.join(__dirname, 'data', 'members.json'),
  productDataFile = path.join(__dirname, 'data', 'products.json')
} = {}) {
  const handleProducts = createProductHandler({ dataFile: productDataFile, seedFile: path.join(publicDirectory, 'data', 'products.json') });
  function readMembers() {
    const members = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')) : [];
    if (!Array.isArray(members)) throw new Error('Invalid member data.');
    return members;
  }
  function reply(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  }
  return http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (await handleProducts(req, res, pathname)) return;
      if (pathname === '/api/members' && req.method === 'GET') return reply(res, 200, readMembers());
      const item = pathname.match(/^\/api\/members\/([\w-]+)$/);
      if ((pathname === '/api/members' && req.method === 'POST') || (item && req.method === 'PUT')) {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 16384) return reply(res, 413, { message: 'Request is too large.' });
        }
        let input;
        try { input = JSON.parse(body); }
        catch { return reply(res, 400, { message: 'Invalid JSON.' }); }
        const result = validateMember(input);
        if (!result.valid) return reply(res, 422, { message: 'Please check the entered details.' });
        const members = readMembers();
        const index = item ? members.findIndex((member) => member.id === item[1]) : -1;
        if (item && index === -1) return reply(res, 404, { message: 'Member not found.' });
        if (members.some((member) => member.email.toLowerCase() === result.member.email && member.id !== item?.[1]))
          return reply(res, 409, { message: 'This email address is already registered.' });
        const member = { id: item ? members[index].id : randomUUID(), ...result.member };
        if (item) members[index] = member;
        else members.push(member);
        fs.mkdirSync(path.dirname(dataFile), { recursive: true });
        fs.writeFileSync(dataFile + '.tmp', JSON.stringify(members, null, 2) + '\n');
        fs.renameSync(dataFile + '.tmp', dataFile);
        return reply(res, item ? 200 : 201, member);
      }
      if (pathname.startsWith('/api/')) return reply(res, 404, { message: 'Endpoint not found.' });
      if (!['GET', 'HEAD'].includes(req.method)) return reply(res, 405, { message: 'Method not allowed.' });
      const filename = path.resolve(publicDirectory, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
      if (!filename.startsWith(publicDirectory + path.sep)) return reply(res, 403, { message: 'Access denied.' });
      if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return reply(res, 404, { message: 'Page not found.' });
      const types = {
        '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
        '.json': 'application/json; charset=utf-8', '.png': 'image/png',
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
        '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ico': 'image/x-icon'
      };
      res.writeHead(200, { 'Content-Type': types[path.extname(filename).toLowerCase()] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(filename));
    } catch (error) {
      console.error(error.message);
      reply(res, 500, { message: 'Unable to load or save the data.' });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const server = createServer();
  server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Open http://localhost:${port}`));
}
module.exports = { createServer };
