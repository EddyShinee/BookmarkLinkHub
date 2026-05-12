import { createApi } from 'unsplash-js';

export default async function handler(req: any, res: any) {
  // const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  const accessKey = "D5kPfVX9wZRc-xt6hjcLR9QhgETuVTnk801kaNp9q0I";

  if (!accessKey) {
    res.status(500).json({ error: 'UNSPLASH_ACCESS_KEY is not configured on the server.' });
    return;
  }

  // Support both GET query (?query=beach) and optional topic.
  const { query, topic, orientation = 'landscape', count } = req.query || {};

  const unsplash = createApi({
    accessKey,
    // Node 18+ has global fetch, unsplash-js chỉ cần thế này.
  });

  try {
    const randomCount =
      typeof count === 'string' && count.trim() !== '' ? Number(count) || 1 : 1;

    const result = await unsplash.photos.getRandom({
      query: typeof query === 'string' ? query : undefined,
      // theo kiểu hiện tại của unsplash-js là topicIds
      topicIds: typeof topic === 'string' ? [topic] : undefined,
      // unsplash-js expects a specific union type cho orientation
      orientation: (typeof orientation === 'string' ? orientation : 'landscape') as any,
      count: randomCount,
    });

    if (result.type === 'error') {
      res.status(500).json({
        error: 'Failed to fetch from Unsplash',
        status: 500,
        body: result.errors,
      });
      return;
    }

    const data = result.response;
    const first = Array.isArray(data) ? data[0] : data;

    if (!first || !first.urls) {
      res.status(500).json({ error: 'Unexpected Unsplash response shape.' });
      return;
    }

    // Prefer smaller URLs first: `full` is multi‑MB and feels very slow as a CSS background.
    const imageUrl =
      first.urls.regular ||
      first.urls.small ||
      first.urls.full ||
      first.urls.raw ||
      first.urls.thumb;

    const thumbUrl = first.urls.thumb || first.urls.small || first.urls.regular || imageUrl;

    res.status(200).json({
      imageUrl,
      thumbUrl,
      authorName: first.user?.name ?? null,
      authorUsername: first.user?.username ?? null,
      authorLink: first.user?.links?.html ?? null,
      unsplashLink: first.links?.html ?? null,
      downloadLink: first.links?.download ?? null,
      downloadLocation: first.links?.download_location ?? null,
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Unexpected error when talking to Unsplash',
      message: err?.message ?? String(err),
    });
  }
}

