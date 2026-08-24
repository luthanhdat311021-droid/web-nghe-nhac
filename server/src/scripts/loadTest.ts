/**
 * MusicWave Scalability & High Traffic Load Testing Suite
 * 
 * Simulates realistic user journeys with high concurrent Virtual Users (VUs):
 * - Homepage hot feeds fetching (Single-Flight Cache-aside benchmark)
 * - Single-Flight hybrid search & autocomplete
 * - High-concurrency song playback recording (Playback write buffer benchmark)
 * - Decoupled async OTP request dispatch (Bulkhead Job Queue benchmark)
 * - Deep subsystem telemetry via /ready
 */

import http from 'http';

interface RequestResult {
  durationMs: number;
  statusCode: number;
  body?: string;
  error?: string;
}

interface ScenarioResult {
  scenarioName: string;
  concurrentVUs: number;
  totalRequests: number;
  successCount: number;
  fail4xxCount: number;
  fail5xxCount: number;
  networkErrors: number;
  durationSec: number;
  rps: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
}

const SERVER_HOST = 'localhost';
const SERVER_PORT = parseInt(process.env.PORT || '5000', 10);

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 1000,
  maxFreeSockets: 200,
  timeout: 10000,
});

let liveSongIds: string[] = [];

const sendRequest = (
  method: string,
  path: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<RequestResult> => {
  return new Promise((resolve) => {
    const start = Date.now();
    const dataStr = body ? JSON.stringify(body) : undefined;

    const req = http.request(
      {
        host: SERVER_HOST,
        port: SERVER_PORT,
        path,
        method,
        agent: httpAgent,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Request-Id': `loadtest_${Math.random().toString(36).slice(2, 8)}`,
          ...(dataStr ? { 'Content-Length': Buffer.byteLength(dataStr) } : {}),
          ...headers,
        },
        timeout: 10000,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          const durationMs = Date.now() - start;
          resolve({ durationMs, statusCode: res.statusCode || 0, body: raw });
        });
      }
    );

    req.on('error', (err) => {
      resolve({ durationMs: Date.now() - start, statusCode: 0, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ durationMs: Date.now() - start, statusCode: 504, error: 'Client Timeout' });
    });

    if (dataStr) {
      req.write(dataStr);
    }
    req.end();
  });
};

const runUserJourney = async (vuId: number): Promise<RequestResult[]> => {
  const results: RequestResult[] = [];
  const userIp = `192.168.${Math.floor(vuId / 254)}.${(vuId % 254) + 1}`;
  const headers = { 'X-Forwarded-For': userIp };

  // Step 1: Health check
  results.push(await sendRequest('GET', '/health', undefined, headers));

  // Step 2: Fetch Homepage Hot Feeds (Trending + Top Charts + Recommended)
  results.push(await sendRequest('GET', '/api/songs/trending', undefined, headers));
  results.push(await sendRequest('GET', '/api/songs/top-charts', undefined, headers));
  results.push(await sendRequest('GET', '/api/songs/recommended', undefined, headers));

  // Step 3: Fast Search & Autocomplete query
  const query = vuId % 2 === 0 ? 'chill' : 'nhac';
  results.push(await sendRequest('GET', `/api/search/suggestions?q=${encodeURIComponent(query)}`, undefined, headers));
  results.push(await sendRequest('GET', `/api/search?q=${encodeURIComponent(query)}`, undefined, headers));

  // Step 4: Genres explore
  results.push(await sendRequest('GET', '/api/admin/genres', undefined, headers));

  // Step 5: High-concurrency song play record (Simulating playback start with real song ID)
  const targetSongId = liveSongIds.length > 0 ? liveSongIds[vuId % liveSongIds.length] : 'default-id';
  results.push(
    await sendRequest('POST', `/api/songs/${targetSongId}/play`, { durationPlayed: 30 }, headers)
  );

  // Step 6: Forgot Password OTP (Decoupled Background Job Queue test)
  if (vuId % 5 === 0) {
    results.push(
      await sendRequest('POST', '/api/auth/forgot-password', {
        email: `loadtest_user_${vuId}@example.com`,
      }, headers)
    );
  }

  return results;
};

const runScenario = async (
  scenarioName: string,
  concurrentVUs: number,
  roundsPerVU = 2
): Promise<ScenarioResult> => {
  console.log(`\n============================================================`);
  console.log(`🚀 Starting Scenario: ${scenarioName} (${concurrentVUs} concurrent Virtual Users)`);
  console.log(`============================================================`);

  const startTime = Date.now();
  const allResults: RequestResult[] = [];

  const vuPromises = Array.from({ length: concurrentVUs }, async (_, i) => {
    for (let r = 0; r < roundsPerVU; r++) {
      const journeyResults = await runUserJourney(i + 1);
      allResults.push(...journeyResults);
    }
  });

  await Promise.all(vuPromises);
  const totalDurationMs = Date.now() - startTime;
  const durationSec = totalDurationMs / 1000;

  const latencies = allResults.map((r) => r.durationMs).sort((a, b) => a - b);
  const totalRequests = allResults.length;
  const successCount = allResults.filter((r) => r.statusCode >= 200 && r.statusCode < 400).length;
  const fail4xxCount = allResults.filter((r) => r.statusCode >= 400 && r.statusCode < 500).length;
  const fail5xxCount = allResults.filter((r) => r.statusCode >= 500).length;
  const networkErrors = allResults.filter((r) => r.statusCode === 0).length;

  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const min = latencies[0] || 0;
  const max = latencies[latencies.length - 1] || 0;
  const avg = Math.round(latencies.reduce((sum, val) => sum + val, 0) / latencies.length) || 0;
  const rps = parseFloat((totalRequests / durationSec).toFixed(1));

  console.log(`\n📊 [RESULTS: ${scenarioName}]`);
  console.log(`  - Total Requests:      ${totalRequests}`);
  console.log(`  - Concurrency (VUs):   ${concurrentVUs}`);
  console.log(`  - Duration:            ${durationSec.toFixed(2)}s`);
  console.log(`  - Throughput (RPS):    ${rps} req/sec`);
  console.log(`  - Success Rate:        ${((successCount / totalRequests) * 100).toFixed(2)}% (${successCount}/${totalRequests})`);
  console.log(`  - 4xx Responses:       ${fail4xxCount}`);
  console.log(`  - 5xx Errors:          ${fail5xxCount}`);
  console.log(`  - Network Errors:      ${networkErrors}`);
  console.log(`  - Latency Min / Avg:   ${min}ms / ${avg}ms`);
  console.log(`  - Latency P50 / P95:   ${p50}ms / ${p95}ms`);
  console.log(`  - Latency P99 / Max:   ${p99}ms / ${max}ms`);

  return {
    scenarioName,
    concurrentVUs,
    totalRequests,
    successCount,
    fail4xxCount,
    fail5xxCount,
    networkErrors,
    durationSec,
    rps,
    p50,
    p95,
    p99,
    min,
    max,
    avg,
  };
};

const main = async () => {
  console.log(`============================================================`);
  console.log(`🔥 MUSICWAVE HIGH-TRAFFIC & LOAD TESTING HARNESS`);
  console.log(`Target: http://${SERVER_HOST}:${SERVER_PORT}`);
  console.log(`============================================================`);

  // 1. Initial health verify & seed discovery
  try {
    const health = await sendRequest('GET', '/ready');
    console.log('🩺 System Readiness Status:', health.statusCode === 200 ? 'READY' : 'DEGRADED');

    const trendingRes = await sendRequest('GET', '/api/songs/trending');
    if (trendingRes.body) {
      const parsed = JSON.parse(trendingRes.body);
      if (Array.isArray(parsed.data)) {
        liveSongIds = parsed.data.map((s: any) => s.id);
        console.log(`🎵 Discovered ${liveSongIds.length} live database songs for playback simulation.`);
      }
    }
  } catch (err) {
    console.error('Cannot connect to server at', `http://${SERVER_HOST}:${SERVER_PORT}`, err);
    process.exit(1);
  }

  // 2. Execute Benchmark Scenarios
  await runScenario('Scenario A — Baseline (100 Concurrent VUs)', 100, 2);
  await runScenario('Scenario B — High Traffic Spike (500 Concurrent VUs)', 500, 2);
  await runScenario('Scenario C — Stress & Peak Load (1,000 Concurrent VUs)', 1000, 2);

  // 3. Telemetry inspection after load
  console.log(`\n============================================================`);
  console.log(`📈 POST-TEST SUBSYSTEM TELEMETRY INSPECTION`);
  console.log(`============================================================`);
  const finalReady = await sendRequest('GET', '/ready');
  if (finalReady.body) {
    try {
      const telemetry = JSON.parse(finalReady.body);
      console.log(JSON.stringify(telemetry, null, 2));
    } catch {
      console.log(finalReady.body);
    }
  }

  console.log(`\n🏁 All Load Test Scenarios Successfully Completed.`);
};

main().catch(console.error);
