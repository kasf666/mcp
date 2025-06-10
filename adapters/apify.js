// adapters/apify.js

const { ApifyClient } = require('apify-client');

const client = new ApifyClient({
  token: process.env.APIFY_TOKEN,
});

async function runApifyActor(actorId, input = {}) {
  if (!actorId || typeof actorId !== 'string') {
    throw new Error(`Expected actorId to be a string, got: ${typeof actorId}`);
  }

  console.log(`▶️ Launching Apify actor: ${actorId} with input:`, input);

  const { runId } = await client.actor(actorId).start({ input });
  console.log('⏳ Waiting for run to finish...', runId);

  const run = await client.run(runId).waitForFinish({ waitSecs: 120 });

  if (run.status !== 'SUCCEEDED') {
    throw new Error(`Actor failed with status: ${run.status}`);
  }

  if (!run.defaultKeyValueStoreId) {
    throw new Error('❌ No key-value store ID found.');
  }

  const record = await client.keyValueStore(run.defaultKeyValueStoreId).getRecord('OUTPUT');

  if (!record || !record.value) {
    throw new Error('❌ No OUTPUT record found in KV store.');
  }

  return Array.isArray(record.value) ? record.value : [record.value];
}

module.exports = { runApifyActor };