const axios = require('axios');

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_USERNAME = 'apimaestro';
const ACTOR_NAME = 'linkedin-profile-detail';

/**
 * Запускает actor и возвращает результат
 * @param {Object} input - input payload, например { username: 'sarptecimer' }
 */
async function runApifyActor(input) {
  try {
    console.log('📦 Sending input to Apify actor:', input);
    // 1. Запустить actor
    const runRes = await axios.post(
      `https://api.apify.com/v2/acts/${ACTOR_USERNAME}~${ACTOR_NAME}/runs?token=${APIFY_TOKEN}`,
      { input }
    );

    const runId = runRes.data.data.id;
    console.log(`🚀 Actor started, runId = ${runId}`);

    // 2. Ожидать завершения
    const runData = await waitForRunCompletion(runId);
    const datasetId = runData.defaultDatasetId;

    if (!datasetId) throw new Error('❌ No dataset ID returned.');

    // 3. Получить items
    const itemsRes = await axios.get(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`
    );

    return itemsRes.data;

  } catch (err) {
    console.error('🔥 Error in runApifyActor:', err.message);
    return `❌ Scrape failed: ${err.message}`;
  }
}

// helper для ожидания завершения
async function waitForRunCompletion(runId) {
  while (true) {
    const res = await axios.get(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );

    const status = res.data.data.status;

    if (status === 'SUCCEEDED') return res.data.data;
    if (status === 'FAILED') throw new Error('Actor failed.');

    console.log(`⏳ Waiting... current status: ${status}`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

module.exports = { runApifyActor };