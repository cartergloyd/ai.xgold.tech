// GET /feed-media/:id serves one public file, but only if it sits in the "Published feed media" folder.
// Directus here cannot filter public file permissions by folder (tested), so this keeps the rest of the
// file library private while letting the website show feed images and videos. Range requests (video
// seeking) are handled by Express sendFile.
const FEED_FOLDER = 'bafa863f-798e-4f4c-a8f6-616768988dcf';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SERVABLE = /^(image\/(png|jpeg|gif|webp|avif|svg\+xml)|video\/(mp4|webm|quicktime)|application\/pdf)$/;

export default {
  id: 'feed-media',
  handler(router, { database, env }) {
    router.get('/:id', async (req, res) => {
      const id = String(req.params.id);
      const file = UUID.test(id) && await database('directus_files').select('filename_disk', 'type').where({ id, folder: FEED_FOLDER, storage: 'local' }).first();
      if (!file || !SERVABLE.test(file.type || '')) return res.status(404).end();
      res.set({
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Content-Type': file.type,
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
      res.sendFile(file.filename_disk, { root: env.STORAGE_LOCAL_ROOT || '/directus/uploads', dotfiles: 'deny' }, (err) => { if (err && !res.headersSent) res.status(404).end(); });
    });
  },
};
