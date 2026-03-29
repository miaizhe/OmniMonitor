"use client";

import React, { useState, useEffect } from "react";
import { 
  Globe, 
  Server, 
  Zap, 
  Cloud, 
  Activity, 
  Users, 
  MapPin, 
  Database,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";

// Helper function to format bytes dynamically
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Mock Data
const trafficData = [
  { time: "00:00", visitors: 120, bandwidth: 2.4 },
  { time: "04:00", visitors: 85, bandwidth: 1.2 },
  { time: "08:00", visitors: 320, bandwidth: 5.6 },
  { time: "12:00", visitors: 450, bandwidth: 8.1 },
  { time: "16:00", visitors: 380, bandwidth: 6.5 },
  { time: "20:00", visitors: 290, bandwidth: 4.8 },
  { time: "23:59", visitors: 150, bandwidth: 2.9 },
];

const regionData = [
  { name: "North America", value: 45 },
  { name: "Europe", value: 30 },
  { name: "Asia", value: 20 },
  { name: "Other", value: 5 },
];

const StatCard = ({ title, value, change, isPositive, icon: Icon }: any) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-2">{value}</h3>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg text-gray-700">
          <Icon size={20} />
        </div>
      </div>
      <div className="mt-4 flex items-center text-sm">
        {isPositive ? (
          <ArrowUpRight size={16} className="text-emerald-500 mr-1" />
        ) : (
          <ArrowDownRight size={16} className="text-rose-500 mr-1" />
        )}
        <span className={isPositive ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
          {change}
        </span>
        <span className="text-gray-400 ml-2">vs last 24h</span>
      </div>
    </CardContent>
  </Card>
);

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedRange, setSelectedRange] = useState("24h");
  const [selectedCfZoneId, setSelectedCfZoneId] = useState("");
  const [selectedTeoZoneId, setSelectedTeoZoneId] = useState("");
  const [cfZones, setCfZones] = useState<Array<{ id: string; name: string }>>([]);
  const [teoZones, setTeoZones] = useState<Array<{ id: string; name: string }>>([]);
  const [realData, setRealData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Function to process EdgeOne chart data MUST be defined before it's used
  const getEdgeOneChartData = (data: any) => {
    if (!data?.edgeOne?.timing) return [];
    const edgeDataList = data.edgeOne.timing.Data || data.edgeOne.timing.data;
    if (!edgeDataList || !edgeDataList[0]) return [];
    const detailData = edgeDataList[0].TypeValue || edgeDataList[0].DetailData;
    if (!detailData) return [];
    const reqMetric = detailData.find((d:any) => d.MetricName === 'l7Flow_request' || d.Key === 'l7Flow_request');
    const records = reqMetric?.Records || reqMetric?.Detail;
    if (!Array.isArray(records)) return [];
    
    return records.map((record: any) => {
      const date = new Date(record.Timestamp * 1000);
      const timeLabel = selectedRange === '7d'
        ? `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:00`
        : selectedRange === '30d'
          ? `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
          : `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      return {
        time: timeLabel,
        visitors: record.Value || 0,
        timestamp: record.Timestamp * 1000
      };
    });
  };

  const getCloudflareChartData = (data: any) => {
    const groups = data?.cloudflare?.timing?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups || [];
    if (!Array.isArray(groups) || groups.length === 0) return [];
    return groups.map((item: any) => {
      const dt = item?.dimensions?.datetime ? new Date(item.dimensions.datetime) : null;
      if (!dt || Number.isNaN(dt.getTime())) return null;
      const timeLabel = selectedRange === '7d'
        ? `${(dt.getMonth() + 1).toString().padStart(2, '0')}-${dt.getDate().toString().padStart(2, '0')} ${dt.getHours().toString().padStart(2, '0')}:00`
        : selectedRange === '30d'
          ? `${(dt.getMonth() + 1).toString().padStart(2, '0')}-${dt.getDate().toString().padStart(2, '0')}`
          : `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
      return {
        time: timeLabel,
        visitors: item?.sum?.visits || 0,
        timestamp: dt.getTime()
      };
    }).filter(Boolean);
  };

  const getEdgeOneRegions = (data: any) => {
    const topCountryData = data?.edgeOne?.topCountry?.Data || data?.edgeOne?.topCountry?.data;
    const countryDetail = topCountryData?.[0]?.DetailData || topCountryData?.[0]?.TypeValue;
    if (!Array.isArray(countryDetail)) return [];
    const countryNameMap: Record<string, string> = {
      'CN': 'China', 'US': 'United States', 'HK': 'Hong Kong', 'TW': 'Taiwan',
      'JP': 'Japan', 'SG': 'Singapore', 'KR': 'South Korea', 'GB': 'United Kingdom'
    };
    return countryDetail.map((item: any) => ({
      name: countryNameMap[item.Key || item.MetricName] || item.Key || item.MetricName,
      value: item.Value || 0
    }));
  };

  const getCloudflareRegions = (data: any) => {
    const groups = data?.cloudflare?.topCountry?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups || [];
    if (!Array.isArray(groups)) return [];
    return groups
      .filter((item: any) => item?.dimensions?.clientCountryName)
      .map((item: any) => ({
        name: item.dimensions.clientCountryName,
        value: item?.sum?.visits || 0
      }));
  };

  const getEdgeOneStatusCodes = (data: any) => {
    const topStatusData = data?.edgeOne?.topStatusCode?.Data || data?.edgeOne?.topStatusCode?.data;
    const statusDetail = topStatusData?.[0]?.DetailData || topStatusData?.[0]?.TypeValue;
    if (!Array.isArray(statusDetail)) return [];
    return statusDetail.map((item: any) => ({
      name: String(item.Key || item.MetricName),
      value: item.Value || 0
    }));
  };

  const getCloudflareStatusCodes = (data: any) => {
    const groups = data?.cloudflare?.topStatusCode?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups || [];
    if (!Array.isArray(groups)) return [];
    return groups
      .filter((item: any) => item?.dimensions?.edgeResponseStatus)
      .map((item: any) => ({
        name: String(item.dimensions.edgeResponseStatus),
        value: item?.sum?.visits || 0
      }));
  };

  // 根据当前选中的 Tab 动态计算用于图表的数据
  const getActiveChartData = () => {
    if (activeTab === 'vercel') return [];
    let sourceData: any[] = [];
    if (activeTab === 'cloudflare') {
      sourceData = getCloudflareChartData(realData);
    } else if (activeTab === 'edgeone') {
      sourceData = getEdgeOneChartData(realData);
    } else {
      const edgeData = getEdgeOneChartData(realData);
      const cfData = getCloudflareChartData(realData);
      const merged = new Map<string, { time: string; visitors: number; timestamp: number }>();
      [...edgeData, ...cfData].forEach((item: any) => {
        const key = item.time;
        const prev = merged.get(key);
        merged.set(key, {
          time: item.time,
          visitors: (prev?.visitors || 0) + (item.visitors || 0),
          timestamp: Math.max(prev?.timestamp || 0, item.timestamp || 0)
        });
      });
      sourceData = Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
    }
    if (!sourceData.length) return [];
    const maxPoints = selectedRange === '1h' ? 30 : selectedRange === '24h' ? 24 : selectedRange === '7d' ? 42 : 30;
    const step = Math.max(1, Math.ceil(sourceData.length / maxPoints));
    return sourceData.filter((_: any, i: number) => i % step === 0 || i === sourceData.length - 1);
  };
  
  const currentChartData = getActiveChartData();

  useEffect(() => {
    setMounted(true);
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ range: selectedRange });
        if (selectedCfZoneId) params.set("cfZoneId", selectedCfZoneId);
        if (selectedTeoZoneId) params.set("teoZoneId", selectedTeoZoneId);
        const res = await fetch(`/api/dashboard?${params.toString()}`);
        const json = await res.json();
        
        if (json.success) {
          setRealData(json.data);
          setCfZones(json.meta?.cfZones || []);
          setTeoZones(json.meta?.teoZones || []);
          if (!selectedCfZoneId && json.meta?.selectedCfZoneId) setSelectedCfZoneId(json.meta.selectedCfZoneId);
          if (!selectedTeoZoneId && json.meta?.selectedTeoZoneId) setSelectedTeoZoneId(json.meta.selectedTeoZoneId);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // 每分钟刷新
    return () => clearInterval(interval);
  }, [selectedRange, selectedCfZoneId, selectedTeoZoneId]);

  // If the component hasn't mounted yet, render a skeleton that matches the server render exactly
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        {/* Sidebar & Header */}
        <nav className="border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center gap-2">
                  <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                    <Activity size={18} className="text-white" />
                  </div>
                  <span className="font-semibold text-lg text-gray-900 tracking-tight">
                    OmniMonitor
                  </span>
                </div>
                <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
                  {['Overview', 'Vercel', 'Cloudflare', 'EdgeOne'].map((item) => (
                    <button
                        key={item}
                        onClick={() => setActiveTab(item.toLowerCase())}
                        className={`${
                          activeTab === item.toLowerCase()
                            ? 'border-black text-gray-900'
                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                        } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                      >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  All Systems Operational
                </div>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              Global Infrastructure Overview
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Real-time telemetry and performance metrics across your serverless edge.
            </p>
          </div>

          {/* Top Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title="Total Requests" value="-" change="Live" isPositive={true} icon={Activity} />
            <StatCard title="Unique Visitors" value="-" change="Live" isPositive={true} icon={Users} />
            <StatCard title="Bandwidth" value="-" change="Live" isPositive={false} icon={Globe} />
            <StatCard title="Active Deployments" value="-" change="Live" isPositive={true} icon={Database} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Sidebar & Header */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center gap-2">
                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                  <Activity size={18} className="text-white" />
                </div>
                <span className="font-semibold text-lg text-gray-900 tracking-tight">
                  OmniMonitor
                </span>
              </div>
              <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
                {['Overview', 'Vercel', 'Cloudflare', 'EdgeOne'].map((item) => (
                  <button
                    key={item}
                    onClick={() => setActiveTab(item.toLowerCase())}
                    className={`${
                      activeTab === item.toLowerCase()
                        ? 'border-black text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                All Systems Operational
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {activeTab === 'overview' && 'Global Infrastructure Overview'}
              {activeTab === 'vercel' && 'Vercel Deployments & Sites'}
              {activeTab === 'cloudflare' && 'Cloudflare Workers & Pages'}
              {activeTab === 'edgeone' && 'Tencent EdgeOne Functions'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Real-time telemetry and performance metrics across your serverless edge.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <span className="text-sm text-gray-500">时间段</span>
            <select
              value={selectedRange}
              onChange={(e) => setSelectedRange(e.target.value)}
              className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <option value="1h">最近 1 小时</option>
              <option value="24h">最近 24 小时</option>
              <option value="7d">最近 7 天</option>
              <option value="30d">最近 30 天</option>
            </select>
            <span className="text-sm text-gray-500">Cloudflare 域名</span>
            <select
              value={selectedCfZoneId}
              onChange={(e) => setSelectedCfZoneId(e.target.value)}
              className="h-9 min-w-[180px] rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              {cfZones.length === 0 ? (
                <option value="">未检测到域名</option>
              ) : (
                cfZones.map((zone) => (
                  <option key={zone.id} value={zone.id}>{zone.name}</option>
                ))
              )}
            </select>
            <span className="text-sm text-gray-500">EdgeOne 域名</span>
            <select
              value={selectedTeoZoneId}
              onChange={(e) => setSelectedTeoZoneId(e.target.value)}
              className="h-9 min-w-[180px] rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              {teoZones.length === 0 ? (
                <option value="">未检测到域名</option>
              ) : (
                teoZones.map((zone) => (
                  <option key={zone.id} value={zone.id}>{zone.name}</option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title={activeTab === 'vercel' ? "Total Deployments" : "Total Requests"} 
            value={
              loading ? "-" : 
              (() => {
                if (activeTab === 'vercel') {
                  return (realData?.vercel?.deployments?.length || 0).toLocaleString();
                }
                
                const cfReqs = activeTab === 'overview' || activeTab === 'cloudflare' 
                  ? (realData?.cloudflare?.data?.viewer?.zones?.[0]?.httpRequests1dGroups?.[0]?.sum?.requests || 0) 
                  : 0;
                  
                let edgeReqs = 0;
                if (activeTab === 'overview' || activeTab === 'edgeone') {
                  const edgeDataList = realData?.edgeOne?.timing?.Data || realData?.edgeOne?.timing?.data || realData?.edgeOne?.Data || realData?.edgeOne?.data;
                  if (edgeDataList && edgeDataList[0]) {
                    const detailData = edgeDataList[0].TypeValue || edgeDataList[0].DetailData;
                    if (detailData) {
                      const reqMetric = detailData.find((d:any) => d.MetricName === 'l7Flow_request' || d.Key === 'l7Flow_request');
                      if (reqMetric && typeof reqMetric.Sum === 'number') {
                        edgeReqs = reqMetric.Sum;
                      } else if (reqMetric && typeof reqMetric.Value === 'number') {
                        edgeReqs = reqMetric.Value;
                      } else {
                        const records = reqMetric?.Records || reqMetric?.Detail;
                        edgeReqs = Array.isArray(records) ? records.reduce((acc: number, curr: any) => acc + (curr.Value || 0), 0) : 0;
                      }
                    }
                  }
                }
                
                return (cfReqs + edgeReqs).toLocaleString() || "0";
              })()
            } 
            change="Live" 
            isPositive={true} 
            icon={activeTab === 'vercel' ? Database : Activity} 
          />
          <StatCard 
            title={activeTab === 'vercel' ? "Failed Deployments" : activeTab === 'edgeone' ? "Top Regions" : "Unique Visitors"} 
            value={
              loading ? "-" : 
              (() => {
                if (activeTab === 'vercel') {
                  const failed = realData?.vercel?.deployments?.filter((d:any) => d.state === 'ERROR' || d.state === 'CANCELED')?.length || 0;
                  return failed.toLocaleString();
                }
                if (activeTab === 'edgeone') {
                  const topCountryData = realData?.edgeOne?.topCountry?.Data || realData?.edgeOne?.topCountry?.data;
                  const countryDetail = topCountryData?.[0]?.DetailData || topCountryData?.[0]?.TypeValue;
                  return (Array.isArray(countryDetail) ? countryDetail.length : 0).toLocaleString();
                }
                
                const cfViews = activeTab === 'overview' || activeTab === 'cloudflare'
                  ? (realData?.cloudflare?.data?.viewer?.zones?.[0]?.httpRequests1dGroups?.[0]?.sum?.pageViews || 0)
                  : 0;

                let edgeReqs = 0;
                if (activeTab === 'overview') {
                  const edgeDataList = realData?.edgeOne?.timing?.Data || realData?.edgeOne?.timing?.data || realData?.edgeOne?.Data || realData?.edgeOne?.data;
                  const detailData = edgeDataList?.[0]?.TypeValue || edgeDataList?.[0]?.DetailData;
                  const reqMetric = detailData?.find((d:any) => d.MetricName === 'l7Flow_request' || d.Key === 'l7Flow_request');
                  if (reqMetric && typeof reqMetric.Sum === 'number') edgeReqs = reqMetric.Sum;
                  else if (reqMetric && typeof reqMetric.Value === 'number') edgeReqs = reqMetric.Value;
                }

                const value = cfViews + edgeReqs;
                return value.toLocaleString() || "0";
              })()
            } 
            change="Live" 
            isPositive={true} 
            icon={Users} 
          />
          <StatCard 
            title={activeTab === 'vercel' ? "Avg Build Time" : "Bandwidth"} 
            value={
              loading ? "-" : 
              (() => {
                if (activeTab === 'vercel') {
                  return "45s"; // Vercel API doesnt expose this easily in simple deployments list, mock for now
                }
                
                const cfBytes = activeTab === 'overview' || activeTab === 'cloudflare'
                  ? (realData?.cloudflare?.data?.viewer?.zones?.[0]?.httpRequests1dGroups?.[0]?.sum?.bytes || 0)
                  : 0;
                
                let edgeBytes = 0;
                if (activeTab === 'overview' || activeTab === 'edgeone') {
                  const edgeDataList = realData?.edgeOne?.timing?.Data || realData?.edgeOne?.timing?.data || realData?.edgeOne?.Data || realData?.edgeOne?.data;
                  if (edgeDataList && edgeDataList[0]) {
                    const detailData = edgeDataList[0].TypeValue || edgeDataList[0].DetailData;
                    if (detailData) {
                      const outFluxMetric = detailData.find((d:any) => 
                        d.MetricName === 'l7Flow_outFlux' || 
                        d.Key === 'l7Flow_outFlux' ||
                        d.MetricName === 'l7Flow_outFlux_byte' ||
                        d.Key === 'l7Flow_outFlux_byte' ||
                        d.MetricName === 'l7Flow_flux' ||
                        d.Key === 'l7Flow_flux'
                      );
                      
                      if (outFluxMetric && typeof outFluxMetric.Sum === 'number') {
                        edgeBytes = outFluxMetric.Sum;
                      } else if (outFluxMetric && typeof outFluxMetric.Value === 'number') {
                        edgeBytes = outFluxMetric.Value;
                      } else {
                        const edgeRecords = outFluxMetric?.Records || outFluxMetric?.Detail;
                        edgeBytes = Array.isArray(edgeRecords) ? edgeRecords.reduce((acc: number, curr: any) => acc + (curr.Value || 0), 0) : 0;
                      }
                    }
                  }
                }
                
                return formatBytes(cfBytes + edgeBytes);
              })()
            } 
            change="Live" 
            isPositive={false} 
            icon={Globe} 
          />
          <StatCard 
            title={activeTab === 'overview' ? "Active Providers" : activeTab === 'vercel' ? "Edge Functions" : activeTab === 'cloudflare' ? "Threats Blocked" : activeTab === 'edgeone' ? "2xx Responses" : "Active Deployments"} 
            value={
              loading ? "-" : 
              (() => {
                if (activeTab === 'overview') {
                  const vercelConnected = realData?.vercel && !realData?.vercel?.error ? 1 : 0;
                  const cloudflareConnected = realData?.cloudflare && !realData?.cloudflare?.error && !realData?.cloudflare?.errors && realData?.cloudflare?.success !== false ? 1 : 0;
                  const edgeOneConnected = realData?.edgeOne && typeof realData?.edgeOne !== 'string' && !realData?.edgeOne?.error ? 1 : 0;
                  return (vercelConnected + cloudflareConnected + edgeOneConnected).toString();
                }
                if (activeTab === 'vercel') {
                  return "0"; // Mock for now
                }
                if (activeTab === 'cloudflare') {
                  return (realData?.cloudflare?.data?.viewer?.zones?.[0]?.httpRequests1dGroups?.[0]?.sum?.threats || 0).toLocaleString();
                }
                if (activeTab === 'edgeone') {
                  const topStatusData = realData?.edgeOne?.topStatusCode?.Data || realData?.edgeOne?.topStatusCode?.data;
                  const statusDetail = topStatusData?.[0]?.DetailData || topStatusData?.[0]?.TypeValue;
                  if (!Array.isArray(statusDetail)) return "0";
                  const okResponses = statusDetail
                    .filter((item: any) => (item.Key || item.MetricName || "").toString().startsWith("2"))
                    .reduce((sum: number, item: any) => sum + (item.Value || 0), 0);
                  return okResponses.toLocaleString();
                }
                return (realData?.vercel?.deployments?.length || 0).toString();
              })()
            } 
            change="Live" 
            isPositive={true} 
            icon={Database} 
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Global Traffic Analysis</CardTitle>
              <CardDescription>Requests and Bandwidth across all providers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                {loading ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : (
                  activeTab === 'vercel' ? (
                    <div className="flex justify-center items-center h-full text-gray-500">
                      Vercel 暂无时序流量接口
                    </div>
                  ) : currentChartData.length === 0 ? (
                    <div className="flex justify-center items-center h-full text-gray-500">
                      当前时间段无可展示数据
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={currentChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#000000" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: '1px solid #eaeaea', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ stroke: '#e5e5e5', strokeWidth: 2, strokeDasharray: '4 4' }}
                      />
                      <Area type="monotone" dataKey="visitors" stroke="#000000" strokeWidth={2} fillOpacity={1} fill="url(#colorVisitors)" />
                    </AreaChart>
                    </ResponsiveContainer>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Regions</CardTitle>
              <CardDescription>Traffic distribution by geography</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full flex flex-col justify-center">
                {loading ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : (() => {
                  if (activeTab === 'vercel') {
                    return <div className="text-center text-gray-500">Vercel 暂无地区分布接口</div>;
                  }
                  const edgeRows = getEdgeOneRegions(realData);
                  const cfRows = getCloudflareRegions(realData);
                  const merged = new Map<string, number>();
                  const sourceRows = activeTab === 'cloudflare'
                    ? cfRows
                    : activeTab === 'edgeone'
                      ? edgeRows
                      : [...edgeRows, ...cfRows];
                  sourceRows.forEach((row: any) => {
                    merged.set(row.name, (merged.get(row.name) || 0) + (row.value || 0));
                  });
                  const topCountries = Array.from(merged.entries())
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 4);
                  if (topCountries.length === 0) {
                    return <div className="text-center text-gray-500">No region data available</div>;
                  }
                  const total = topCountries.reduce((acc: number, curr: any) => acc + curr.value, 0);
                  return topCountries.map((region: any, i: number) => {
                    const percentage = total > 0 ? Math.round((region.value / total) * 100) : 0;
                    return (
                      <div key={i} className="mb-4 last:mb-0">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 flex items-center">
                            <MapPin size={14} className="mr-1 text-gray-400" />
                            {region.name}
                          </span>
                          <span className="text-gray-500">{percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="bg-black h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status Codes</CardTitle>
              <CardDescription>Response code distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                {loading ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : (() => {
                  if (activeTab === 'vercel') {
                    return <div className="flex justify-center items-center h-full text-gray-500">Vercel 暂无状态码接口</div>;
                  }
                  const edgeRows = getEdgeOneStatusCodes(realData);
                  const cfRows = getCloudflareStatusCodes(realData);
                  const merged = new Map<string, number>();
                  const sourceRows = activeTab === 'cloudflare'
                    ? cfRows
                    : activeTab === 'edgeone'
                      ? edgeRows
                      : [...edgeRows, ...cfRows];
                  sourceRows.forEach((row: any) => {
                    merged.set(row.name, (merged.get(row.name) || 0) + (row.value || 0));
                  });
                  const formattedStatusData = Array.from(merged.entries())
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5);
                  if (formattedStatusData.length === 0) {
                    return <div className="flex justify-center items-center h-full text-gray-500">No status code data</div>;
                  }
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={formattedStatusData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} width={40} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: '1px solid #eaeaea', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          cursor={{ fill: '#f5f5f5' }}
                        />
                        <Bar dataKey="value" fill="#000000" radius={[0, 4, 4, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Provider Specific Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Vercel Card */}
          <Card className={(activeTab === 'overview' || activeTab === 'vercel') ? 'block' : 'hidden'}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <span className="bg-black text-white p-1.5 rounded-md">
                    <svg viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4"><path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="currentColor"/></svg>
                  </span>
                  Vercel Sites
                </CardTitle>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Online</span>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : !realData?.vercel || realData.vercel.error ? (
                <div className="flex flex-col justify-center items-center h-32 text-gray-400 text-center">
                  <span className="text-sm">No API Key configured or Auth Error</span>
                  <span className="text-xs mt-1">{realData?.vercel?.error?.message || "Configure VERCEL_API_TOKEN in .env"}</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Deployments (Latest)</span>
                    <span className="font-medium text-gray-900">
                      {realData?.vercel?.deployments?.length || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Avg Build Time</span>
                    <span className="font-medium text-gray-900">-</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Edge Requests</span>
                    <span className="font-medium text-gray-900">-</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Function Errors</span>
                    <span className="font-medium text-gray-900">-</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cloudflare Card */}
          <Card className={(activeTab === 'overview' || activeTab === 'cloudflare') ? 'block' : 'hidden'}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <span className="bg-[#F38020] text-white p-1.5 rounded-md">
                    <Cloud size={16} />
                  </span>
                  Cloudflare Edge
                </CardTitle>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Online</span>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : !realData?.cloudflare || realData.cloudflare.error || realData.cloudflare.errors || realData.cloudflare.success === false ? (
                <div className="flex flex-col justify-center items-center h-32 text-gray-400 text-center">
                  <span className="text-sm">No API Key configured or Auth Error</span>
                  <span className="text-xs mt-1">{realData?.cloudflare?.errors?.[0]?.message || realData?.cloudflare?.error || "Configure CLOUDFLARE_API_TOKEN in .env"}</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Total Requests</span>
                    <span className="font-medium text-gray-900">
                      {realData?.cloudflare?.data?.viewer?.zones?.[0]?.httpRequests1dGroups?.[0]?.sum?.requests?.toLocaleString() || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Total Bytes</span>
                    <span className="font-medium text-gray-900">
                      {realData?.cloudflare?.data?.viewer?.zones?.[0]?.httpRequests1dGroups?.[0]?.sum?.bytes ? 
                        formatBytes(realData.cloudflare.data.viewer.zones[0].httpRequests1dGroups[0].sum.bytes) 
                        : "0 B"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Page Views</span>
                    <span className="font-medium text-gray-900">
                      {realData?.cloudflare?.data?.viewer?.zones?.[0]?.httpRequests1dGroups?.[0]?.sum?.pageViews?.toLocaleString() || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Threats Blocked</span>
                    <span className="font-medium text-gray-900">
                      {realData?.cloudflare?.data?.viewer?.zones?.[0]?.httpRequests1dGroups?.[0]?.sum?.threats?.toLocaleString() || "0"}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* EdgeOne Card */}
          <Card className={(activeTab === 'overview' || activeTab === 'edgeone') ? 'block' : 'hidden'}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <span className="bg-[#0052D9] text-white p-1.5 rounded-md">
                    <Zap size={16} />
                  </span>
                  EdgeOne Functions
                </CardTitle>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Online</span>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : !realData?.edgeOne || typeof realData.edgeOne === 'string' || realData.edgeOne.error ? (
                <div className="flex flex-col justify-center items-center h-32 text-gray-400">
                  <span className="text-sm">No API Key configured or API Error</span>
                  <span className="text-xs mt-1">{realData?.edgeOne?.error || (typeof realData?.edgeOne === 'string' ? realData.edgeOne : "Configure TENCENTCLOUD keys in .env")}</span>
                  <pre className="text-[10px] mt-2 max-w-full overflow-hidden text-ellipsis px-4 text-gray-300">
                    {JSON.stringify(realData?.edgeOne).substring(0, 50)}
                  </pre>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Total Requests</span>
                    <span className="font-medium text-gray-900">
                      {(() => {
                        const edgeDataList = realData?.edgeOne?.timing?.Data || realData?.edgeOne?.timing?.data || realData?.edgeOne?.Data || realData?.edgeOne?.data;
                        
                        // Let's log to browser console to see what we're actually getting
                        if (typeof window !== 'undefined') {
                          console.log("EdgeOne Data in Frontend:", realData?.edgeOne);
                        }

                        if (!edgeDataList || !edgeDataList[0]) return "0";
                          
                          const detailData = edgeDataList[0].TypeValue || edgeDataList[0].DetailData;
                          if (!detailData) return "0";

                          const requestMetric = detailData.find((d:any) => d.MetricName === 'l7Flow_request' || d.Key === 'l7Flow_request');
                          
                          if (requestMetric && typeof requestMetric.Sum === 'number') {
                            return requestMetric.Sum.toLocaleString();
                          }
                          if (requestMetric && typeof requestMetric.Value === 'number') {
                            return requestMetric.Value.toLocaleString();
                          }
                          
                          const records = requestMetric?.Records || requestMetric?.Detail;
                          if (!records || !Array.isArray(records)) return "0";
                          const sum = records.reduce((acc: number, curr: any) => acc + (curr.Value || 0), 0);
                          return sum.toLocaleString();
                        })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Total OutFlux</span>
                    <span className="font-medium text-gray-900">
                      {(() => {
                        const edgeDataList = realData?.edgeOne?.timing?.Data || realData?.edgeOne?.timing?.data || realData?.edgeOne?.Data || realData?.edgeOne?.data;
                        if (!edgeDataList || !edgeDataList[0]) return "0 B";
                        
                        const detailData = edgeDataList[0].TypeValue || edgeDataList[0].DetailData;
                        if (!detailData) return "0 B";

                        const outFluxMetric = detailData.find((d:any) => 
                          d.MetricName === 'l7Flow_outFlux' || 
                          d.Key === 'l7Flow_outFlux' ||
                          d.MetricName === 'l7Flow_outFlux_byte' ||
                          d.Key === 'l7Flow_outFlux_byte' ||
                          d.MetricName === 'l7Flow_flux' ||
                          d.Key === 'l7Flow_flux'
                        );
                        
                        let sumBytes = 0;
                        if (outFluxMetric && typeof outFluxMetric.Sum === 'number') {
                          sumBytes = outFluxMetric.Sum;
                        } else if (outFluxMetric && typeof outFluxMetric.Value === 'number') {
                          sumBytes = outFluxMetric.Value;
                        } else {
                          const records = outFluxMetric?.Records || outFluxMetric?.Detail;
                          if (!records || !Array.isArray(records)) return "0 B";
                          sumBytes = records.reduce((acc: number, curr: any) => acc + (curr.Value || 0), 0);
                        }
                        
                        return formatBytes(sumBytes);
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Avg Latency</span>
                    <span className="font-medium text-gray-900">-</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">CPU Usage</span>
                    <span className="font-medium text-gray-900">-</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
