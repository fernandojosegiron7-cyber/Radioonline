module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const mount = String(req.query.mount || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!mount) {
    return res.status(400).json({ error: 'Mount requerido' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);

  try {
    const endpoint = `https://api.zeno.fm/mounts/metadata/subscribe/${encodeURIComponent(mount)}`;
    const response = await fetch(endpoint, {
      headers: { Accept: 'text/event-stream, application/json, text/plain' },
      signal: controller.signal
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Zeno metadata unavailable' });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (buffer.length < 65536) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const blocks = buffer.split(/\r?\n\r?\n/);
      for (const block of blocks) {
        const dataLines = block
          .split(/\r?\n/)
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trim());

        if (!dataLines.length) continue;
        const raw = dataLines.join('\n');
        try {
          const json = JSON.parse(raw);
          return res.status(200).json(json);
        } catch (_) {
          return res.status(200).json({ title: raw });
        }
      }
    }

    return res.status(204).end();
  } catch (error) {
    if (error && error.name === 'AbortError') {
      return res.status(504).json({ error: 'Metadata timeout' });
    }
    return res.status(500).json({ error: 'Metadata proxy error' });
  } finally {
    clearTimeout(timeout);
  }
};
