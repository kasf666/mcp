const { askLLM } = require('../adapters/openai');
const { getQualifiedLeads } = require('../adapters/supabase');
const { runApifyActor } = require('../utils/runApifyActorViaRest');
const { routerPrompt } = require('../prompts/routerPrompt');

async function handleMessage({ user, message, channel }) {
  try {
    // Шаг 1 — пробуем классифицировать
    const reasoning = await askLLM({
      systemPrompt: routerPrompt,
      userMessage: message,
    });

    console.log('🧠 LLM classified as:', reasoning);

    const parsed = JSON.parse(reasoning);

    // Шаг 2 — если получилось, выполняем команду
    switch (parsed.action) {
      case 'get-leads':
        return await handleGetLeads(parsed.filters);
      case 'summarize':
        return await handleSummarize(parsed.text);
      case 'scrape':
        return await handleScrape(parsed);
      case 'chitchat':
        return await askLLM({
          systemPrompt: 'You are a helpful assistant. Answer user questions clearly.',
          userMessage: message
        });
      default:
        return `❓ Unknown action: ${parsed.action}`;
    }

  } catch (error) {
    // Шаг 3 — если GPT не вернул валидный JSON (или ошибка), просто отвечаем на вопрос
    console.warn('🗨 GPT fallback: answering as assistant:', error.message);

    const reply = await askLLM({
      systemPrompt: 'You are a helpful assistant. Answer user questions clearly.',
      userMessage: message
    });

    return reply;
  }
}

async function handleGetLeads(filters = {}) {
  const normalizedFilters = { ...filters };

  normalizedFilters.limit = Math.min(
    filters.limit || filters.count || filters.quantity || 10,
    10
  );

  if (filters.latest || filters.recent || filters.sort === 'latest') {
    normalizedFilters.latest = true;
  }

  const leads = await getQualifiedLeads(normalizedFilters);

  if (!leads.length) return 'No leads found.';

  return leads.map(
    lead => `• ${lead.userName} (${lead.companyName}) — ${lead.reason}`
  ).join('\n');
}

async function handleSummarize(text) {
  const summarizationPrompt = `
You are a smart assistant that summarizes text clearly and briefly.
- Use 1–3 sentences
- Focus on key ideas
- Avoid repetition or filler
- Respond with the summary only
`;

  return await askLLM({
    systemPrompt: summarizationPrompt,
    userMessage: text,
  });
}

async function handleScrape({ url }) {
  if (!url) return '❌ Missing LinkedIn profile URL.';

  const username = extractLinkedInUsername(url);
  if (!username) return '❌ Could not extract username from URL.';

  const actorId = 'apimaestro/linkedin-profile-detail';
  const input = { username };

  try {
    console.log('🧪 Launching Apify actor with:', input);
    const result = await runApifyActor(actorId, input);
    const firstProfile = Array.isArray(result) ? result[0] : result;

    return formatLinkedInProfile(firstProfile);
  } catch (err) {
    console.error('❌ Apify run failed:', err);
    return `❌ Scrape failed: ${err.message}`;
  }
}

function extractLinkedInUsername(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/');
    return parts.filter(Boolean).pop();
  } catch (err) {
    return null;
  }
}

function formatLinkedInProfile(profile) {
  if (!profile || !profile.basic_info) return '❌ No profile data found.';
  const info = profile.basic_info;

  return [
    `👤 ${info.fullname}`,
    info.headline && `💼 ${info.headline}`,
    info.location?.full && `📍 ${info.location.full}`,
    info.current_company && `🏢 ${info.current_company}`,
    info.about && `📝 ${info.about.slice(0, 300)}...`,
    info.profile_picture_url && `🖼 ${info.profile_picture_url}`
  ].filter(Boolean).join('\n');
}

module.exports = { handleMessage };
