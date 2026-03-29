import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const normalizeConfigValue = (value: string | undefined | null) => {
      if (!value) return '';
      if (value.startsWith('your_')) return '';
      if (value.includes('placeholder')) return '';
      return value;
    };
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '24h';
    const selectedCfZoneId = normalizeConfigValue(searchParams.get('cfZoneId'));
    const selectedTeoZoneId = normalizeConfigValue(searchParams.get('teoZoneId'));
    const rangeMap: Record<string, { durationMs: number; interval: string }> = {
      '1h': { durationMs: 1 * 60 * 60 * 1000, interval: 'min' },
      '24h': { durationMs: 24 * 60 * 60 * 1000, interval: 'min' },
      '7d': { durationMs: 7 * 24 * 60 * 60 * 1000, interval: 'hour' },
      '30d': { durationMs: 30 * 24 * 60 * 60 * 1000, interval: 'day' }
    };
    const selectedRange = rangeMap[range] || rangeMap['24h'];

    // 1. 获取 Vercel 数据 (部署和状态)
    // 文档: https://vercel.com/docs/rest-api
    const vercelRes = await fetch('https://api.vercel.com/v6/deployments?limit=10', {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
      },
      next: { revalidate: 60 } // 每分钟刷新一次
    });
    const vercelData = await vercelRes.json();

    // 2. 获取 Cloudflare 数据 (自动识别域名 Zone ID)
    // 如果没有提供 CLOUDFLARE_ZONE_ID，我们可以通过 API 自动获取列表中的第一个 Zone
    let cfZoneId = selectedCfZoneId || normalizeConfigValue(process.env.CLOUDFLARE_ZONE_ID) || '';
    let cfZones: Array<{ id: string; name: string }> = [];

    if (process.env.CLOUDFLARE_API_TOKEN) {
      const zonesRes = await fetch('https://api.cloudflare.com/client/v4/zones', {
        headers: {
          'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        }
      });
      const zonesData = await zonesRes.json();
      if (zonesData.success && zonesData.result.length > 0) {
        cfZones = zonesData.result.map((z: any) => ({ id: z.id, name: z.name }));
        if (!cfZoneId) {
          cfZoneId = zonesData.result[0].id;
          console.log(`Auto-detected Cloudflare Zone ID: ${cfZoneId} for domain: ${zonesData.result[0].name}`);
        }
      }
    }

    let cfData = null;
    if (cfZoneId) {
      const cfStartDate = new Date(Date.now() - selectedRange.durationMs);
      const cfDateGt = cfStartDate.toISOString().slice(0, 10);
      const cfStartIso = cfStartDate.toISOString();
      const cfEndIso = new Date().toISOString();

      const callCfGraph = async (query: string) => {
        const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
          next: { revalidate: 60 }
        });
        return res.json();
      };

      const cfSummaryQuery = `
        query {
          viewer {
            zones(filter: {zoneTag: "${cfZoneId}"}) {
              httpRequests1dGroups(limit: 1, filter: {date_gt: "${cfDateGt}"}) {
                sum {
                  bytes
                  requests
                  pageViews
                  threats
                }
              }
            }
          }
        }
      `;
      const cfTimingQuery = `
        query {
          viewer {
            zones(filter: {zoneTag: "${cfZoneId}"}) {
              httpRequestsAdaptiveGroups(
                limit: 1000,
                filter: {datetime_geq: "${cfStartIso}", datetime_leq: "${cfEndIso}"}
              ) {
                dimensions {
                  datetime
                }
                sum {
                  visits
                }
              }
            }
          }
        }
      `;
      const cfTopCountryQuery = `
        query {
          viewer {
            zones(filter: {zoneTag: "${cfZoneId}"}) {
              httpRequestsAdaptiveGroups(
                limit: 10,
                filter: {datetime_geq: "${cfStartIso}", datetime_leq: "${cfEndIso}"}
              ) {
                dimensions {
                  clientCountryName
                }
                sum {
                  visits
                }
              }
            }
          }
        }
      `;
      const cfTopStatusQuery = `
        query {
          viewer {
            zones(filter: {zoneTag: "${cfZoneId}"}) {
              httpRequestsAdaptiveGroups(
                limit: 10,
                filter: {datetime_geq: "${cfStartIso}", datetime_leq: "${cfEndIso}"}
              ) {
                dimensions {
                  edgeResponseStatus
                }
                sum {
                  visits
                }
              }
            }
          }
        }
      `;

      const [summaryRes, timingRes, topCountryRes, topStatusRes] = await Promise.all([
        callCfGraph(cfSummaryQuery),
        callCfGraph(cfTimingQuery),
        callCfGraph(cfTopCountryQuery),
        callCfGraph(cfTopStatusQuery)
      ]);

      cfData = {
        ...summaryRes,
        timing: timingRes,
        topCountry: topCountryRes,
        topStatusCode: topStatusRes
      };
    }

    // 3. 腾讯云 EdgeOne (TEO) 数据获取 (国际版) - 自动识别域名 Zone ID
    let edgeOneData = null;
    let teoZoneId = selectedTeoZoneId || normalizeConfigValue(process.env.TENCENTCLOUD_ZONE_ID) || '';
    let teoZones: Array<{ id: string; name: string }> = [];

    // 如果提供了 SecretId 和 SecretKey，但没有提供 Zone ID，则尝试自动获取
    if (process.env.TENCENTCLOUD_SECRET_ID && process.env.TENCENTCLOUD_SECRET_KEY) {
      try {
        // 使用动态导入避免在没有安装 SDK 时导致整个 API 崩溃
        const tencentcloud = await import("tencentcloud-sdk-nodejs-teo");
        const TeoClient = tencentcloud.teo.v20220901.Client;
        
        const client = new TeoClient({
          credential: {
            secretId: process.env.TENCENTCLOUD_SECRET_ID,
            secretKey: process.env.TENCENTCLOUD_SECRET_KEY,
          },
          region: "ap-singapore", 
          profile: { 
            httpProfile: { 
              endpoint: "teo.tencentcloudapi.com" 
            } 
          },
        });

        const zonesResponse = await client.DescribeZones({ Limit: 100 });
        if (zonesResponse.Zones && zonesResponse.Zones.length > 0) {
          teoZones = zonesResponse.Zones.map((z: any) => ({ id: z.ZoneId, name: z.ZoneName }));
          if (!teoZoneId) {
            teoZoneId = zonesResponse.Zones[0].ZoneId || '';
            console.log(`Auto-detected EdgeOne Zone ID: ${teoZoneId} for domain: ${zonesResponse.Zones[0].ZoneName}`);
          }
        }

        // 获取该站点的流量数据和 Top 数据
        if (teoZoneId) {
          const endTime = new Date();
          const startTime = new Date(endTime.getTime() - selectedRange.durationMs);
          
          // 腾讯云要求的时间格式是 ISO8601 且不带毫秒
          const formatTeoTime = (date: Date) => date.toISOString().split('.')[0] + 'Z';
          
          // 1. 获取时间序列流量数据 (请求数和带宽)
          const timingData = await client.DescribeTimingL7AnalysisData({
            ZoneIds: [teoZoneId],
            StartTime: formatTeoTime(startTime),
            EndTime: formatTeoTime(endTime),
            MetricNames: ["l7Flow_outFlux", "l7Flow_request"],
            Interval: selectedRange.interval
          });
          
          // 2. 获取 Top 分析数据 (国家/地区排行)
          const topCountryData = await client.DescribeTopL7AnalysisData({
            ZoneIds: [teoZoneId],
            StartTime: formatTeoTime(startTime),
            EndTime: formatTeoTime(endTime),
            MetricName: "l7Flow_request_country",
            Limit: 5
          });

          // 3. 获取 Top 分析数据 (状态码)
          const topStatusCodeData = await client.DescribeTopL7AnalysisData({
            ZoneIds: [teoZoneId],
            StartTime: formatTeoTime(startTime),
            EndTime: formatTeoTime(endTime),
            MetricName: "l7Flow_request_statusCode",
            Limit: 5
          });

          edgeOneData = {
            timing: timingData,
            topCountry: topCountryData,
            topStatusCode: topStatusCodeData
          };
          
          console.log("EdgeOne Data Successfully Fetched");
        }
      } catch (teoError: any) {
        console.error("EdgeOne API Error:", teoError.message || teoError);
        edgeOneData = { error: teoError.message || "Failed to fetch EdgeOne data" };
      }
    } else {
      edgeOneData = "Missing Tencent Cloud Credentials";
    }

    // 返回组装好的真实数据结构，供前端图表使用
    return NextResponse.json({
      success: true,
      data: {
        vercel: vercelData,
        cloudflare: cfData,
        edgeOne: edgeOneData
      },
      meta: {
        range,
        selectedCfZoneId: cfZoneId,
        selectedTeoZoneId: teoZoneId,
        cfZones,
        teoZones
      }
    });
  } catch (error) {
    console.error('API Fetch Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch monitoring data' },
      { status: 500 }
    );
  }
}
