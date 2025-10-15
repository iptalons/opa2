
import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Legend,
  Cell,
  AreaChart,
  Area,
} from "recharts";

import {
  API_BASE,
  MAILTO,
  CURRENT_YEAR,
  OA_COLORS,
  PALETTE,
  RISK_CHIP,
  RISK_HEX,
} from "./constants";
import { oaFetch, extractId } from "./lib/utils";
import { useDebounce } from "./hooks/useDebounce";

import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "./components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./components/ui/select";
import {
  Icons,
} from "./components/icons";

/* =========================
   Component
========================= */
export default function OpenAlexDemo() {
  // ----- page state -----
  const [query, setQuery] = useState("");
  const dq = useDebounce(query);
  const [topicResults, setTopicResults] = useState<any[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<any | null>(null);

  const [institutionQuery, setInstitutionQuery] = useState("");
  const diq = useDebounce(institutionQuery);
  const [institutionResults, setInstitutionResults] = useState<any[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<any | null>(
    null
  );

  const [fromYear, setFromYear] = useState(CURRENT_YEAR - 10);
  const [country, setCountry] = useState("");

  const [trend, setTrend] = useState<any[]>([]);
  const [oaGroups, setOaGroups] = useState<{ status: string; count: number }[]>(
    []
  );
  const [topAuthors, setTopAuthors] = useState<any[]>([]);
  const [authorDetails, setAuthorDetails] = useState<any[]>([]);
  const [recentCollabs, setRecentCollabs] = useState<Record<string, number>>(
    {}
  );
  const [totalCollabs, setTotalCollabs] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const isInitialState = !selectedTopic && !selectedInstitution;


  // ----- modal state -----
  const [collabOpen, setCollabOpen] = useState(false);
  const [collabAuthor, setCollabAuthor] = useState<any | null>(null);
  const [collabRows, setCollabRows] = useState<any[]>([]);
  const [collabLoading, setCollabLoading] = useState(false);
  const [collabError, setCollabError] = useState("");

  // modal filters
  const [collabSearch, setCollabSearch] = useState("");
  const [filterOrg, setFilterOrg] = useState("ALL");
  const [filterCountry, setFilterCountry] = useState("ALL");
  const [filterRisk, setFilterRisk] = useState("ALL");

  // modal series + freshness (declare ONCE)
  const [collabSeries, setCollabSeries] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  /* ---------- topic search (contains) ---------- */
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      const q = (dq || "").trim();
      if (q.length < 2) {
        setTopicResults([]);
        return;
      }
      try {
        const d = await oaFetch(
          `/autocomplete/topics?q=${encodeURIComponent(
            q
          )}&filter=display_name.search:${q}`,
          { signal: controller.signal }
        );
        setTopicResults(d?.results || []);
      } catch (e) {
        if (!controller.signal.aborted) console.error(e);
      }
    })();
    return () => controller.abort();
  }, [dq]);

  /* ---------- institution search ---------- */
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      const q = (diq || "").trim();
      if (q.length < 2) {
        setInstitutionResults([]);
        return;
      }
      try {
        const d = await oaFetch(
          `/autocomplete/institutions?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        setInstitutionResults(d?.results || []);
      } catch (e) {
        if (!controller.signal.aborted) console.error(e);
      }
    })();
    return () => controller.abort();
  }, [diq]);

  /* ---------- analytics load ---------- */
  useEffect(() => {
    if (!selectedTopic && !selectedInstitution) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");

    (async () => {
      try {
        const baseFilters: string[] = [];

        if (selectedTopic) {
          baseFilters.push(`topics.id:${extractId(selectedTopic.id)}`);
        }
        if (country) {
          const countryCodes = country.split(",").map(c => c.trim().toLowerCase()).filter(Boolean).join("|");
          if (countryCodes) {
            baseFilters.push(`authorships.institutions.country_code:${countryCodes}`);
          }
        }
        if (selectedInstitution) {
          baseFilters.push(
            `authorships.institutions.id:${extractId(selectedInstitution.id)}`
          );
        }

        const filterStr = [...baseFilters, `from_publication_date:${fromYear}-01-01`].join(",");
        const oaFilterStr = [...baseFilters, `from_publication_date:${Math.max(fromYear, CURRENT_YEAR - 5)}-01-01`].join(",");


        const apiPromises = [
          oaFetch(
            `/works?filter=${encodeURIComponent(
              filterStr
            )}&group_by=publication_year&sort=key:asc&per-page=200`,
            { signal: controller.signal }
          ),
          oaFetch(
            `/works?filter=${encodeURIComponent(
              `${filterStr},authors_count:>1`
            )}&group_by=publication_year&sort=key:asc&per-page=200`,
            { signal: controller.signal }
          ),
          oaFetch(
            `/works?filter=${encodeURIComponent(
              oaFilterStr
            )}&group_by=oa_status&per-page=50`,
            { signal: controller.signal }
          ),
          oaFetch(
            `/works?filter=${encodeURIComponent(
              filterStr
            )}&group_by=authorships.author.id&sort=count:desc&per-page=50`,
            { signal: controller.signal }
          ),
        ];

        const [trendRes, collabRes, oaRes, topRes] = await Promise.all(apiPromises);


        const trendMap = new Map(
          (trendRes?.group_by || []).map((g: any) => [g.key, g.count])
        );
        const collabMap = new Map(
          (collabRes?.group_by || []).map((g: any) => [g.key, g.count])
        );
        const allYears = Array.from(
          new Set([...trendMap.keys(), ...collabMap.keys()])
        ).sort();

        setTrend(
          allYears.map((year) => ({
            year,
            Works: trendMap.get(year) || 0,
            Collaborations: collabMap.get(year) || 0,
          }))
        );

        setOaGroups(
          (oaRes?.group_by || []).map((g: any) => ({
            status: g.key_display_name || g.key,
            count: g.count,
          }))
        );

        const groups = (topRes?.group_by || []).map((g: any) => ({
          id: extractId(g.key),
          display: g.key_display_name || g.key,
          count: g.count,
        }));
        setTopAuthors(groups);

        // details
        if (groups.length) {
          const ids = groups.map((g: any) => g.id);
          const details = await oaFetch(
            `/authors?filter=openalex:${ids.join(
              "|"
            )}&per-page=${ids.length}&select=id,display_name,orcid,works_count,cited_by_count,last_known_institutions,summary_stats`
          );
          const m = new Map(
            (details?.results || []).map((a: any) => [extractId(a.id), a])
          );
          setAuthorDetails(ids.map((id: string) => m.get(id)).filter(Boolean));

          // recent + total collab counts (optimized)
          const collabPromises = ids.map(async (id) => {
            const [r, t] = await Promise.all([
              oaFetch(
                `/works?filter=${encodeURIComponent(
                  `${filterStr},authorships.author.id:${id}`
                )}&group_by=authorships.author.id&per-page=200`,
                { signal: controller.signal }
              ).catch(() => null),
              oaFetch(
                `/works?filter=${encodeURIComponent(
                  `authorships.author.id:${id}`
                )}&group_by=authorships.author.id&per-page=200`,
                { signal: controller.signal }
              ).catch(() => null),
            ]);
            return {
              id,
              recentCount: (r?.group_by || []).filter((g: any) => extractId(g.key) !== id).length,
              totalCount: (t?.group_by || []).filter((g: any) => extractId(g.key) !== id).length,
            };
          });

          const collabResults = await Promise.all(collabPromises);
          const recent: Record<string, number> = {};
          const total: Record<string, number> = {};
          collabResults.forEach(res => {
            recent[res.id] = res.recentCount;
            total[res.id] = res.totalCount;
          });
          setRecentCollabs(recent);
          setTotalCollabs(total);
        } else {
          setAuthorDetails([]);
        }
      } catch (e: any) {
        if (!controller.signal.aborted) setError(e?.message || String(e));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [selectedTopic, fromYear, country, selectedInstitution]);

  const mergedAuthors = useMemo(() => {
    if (!topAuthors?.length) return [];
    const map = new Map(topAuthors.map((a) => [a.id, { ...a }]));
    authorDetails.forEach((d: any) => {
      const id = extractId(d?.id);
      const base: any = map.get(id);
      if (base) {
        const mainInstitution = d?.last_known_institutions?.[0];
        base.display_name = d.display_name;
        base.orcid = d.orcid;
        base.works_count = d.works_count;
        base.cited_by_count = d.cited_by_count;
        base.last_known_institution_name = mainInstitution?.display_name;
        base.last_known_institution_id = mainInstitution?.id; // for filtering
        base.country_code = mainInstitution?.country_code?.toUpperCase(); // for display
        base.h_index = d?.summary_stats?.h_index;
      }
    });
    
    return Array.from(map.values());
  }, [topAuthors, authorDetails]);

  /* ---------- open modal ---------- */
  const openCollab = (author: any) => {
    setCollabAuthor(author);
    setCollabOpen(true);
    setLastUpdated(null);
    setCollabSearch('');
    setFilterOrg('ALL');
    setFilterCountry('ALL');
    setFilterRisk('ALL');
  };

  /* ---------- load collaborations (modal) ---------- */
  useEffect(() => {
    if (!collabOpen || !collabAuthor || (!selectedTopic && !selectedInstitution)) return;
    const controller = new AbortController();
    setCollabLoading(true);
    setCollabError("");
    setCollabRows([]);

    (async () => {
      try {
        const aid = extractId(collabAuthor.id);
        const filters = [`from_publication_date:${fromYear}-01-01`];
        
        if (selectedTopic) {
          filters.push(`topics.id:${extractId(selectedTopic.id)}`);
        }
        if (country) {
             const countryCodes = country.split(",").map(c => c.trim().toLowerCase()).filter(Boolean).join("|");
             if (countryCodes) {
                filters.push(`authorships.institutions.country_code:${countryCodes}`);
             }
        }
        if (selectedInstitution) {
          filters.push(
            `authorships.institutions.id:${extractId(selectedInstitution.id)}`
          );
        }

        const recentFilter = filters.join(",");

        const [recentRes, totalRes] = await Promise.all([
          oaFetch(
            `/works?filter=${encodeURIComponent(
              `${recentFilter},authorships.author.id:${aid}`
            )}&group_by=authorships.author.id&per-page=200`,
            { signal: controller.signal }
          ),
          oaFetch(
            `/works?filter=${encodeURIComponent(
              `authorships.author.id:${aid}`
            )}&group_by=authorships.author.id&per-page=200`,
            { signal: controller.signal }
          ),
        ]);

        const recentGroups = (recentRes?.group_by || []).filter(
          (g: any) => extractId(g.key) !== aid
        );
        const totalGroups = (totalRes?.group_by || []).filter(
          (g: any) => extractId(g.key) !== aid
        );

        const allIds = Array.from(
          new Set([...recentGroups, ...totalGroups].map((g: any) => extractId(g.key)))
        ).slice(0, 60);
        const recentMap = new Map(
          recentGroups.map((g: any) => [extractId(g.key), g.count])
        );
        const totalMap = new Map(
          totalGroups.map((g: any) => [extractId(g.key), g.count])
        );

        // collaborator details
        const dRes =
          allIds.length > 0
            ? await oaFetch(
                `/authors?filter=openalex:${allIds.join(
                  "|"
                )}&per-page=${allIds.length}&select=id,display_name,orcid,last_known_institutions`
              )
            : { results: [] };
        const dMap = new Map(
          (dRes?.results || []).map((a: any) => [extractId(a.id), a])
        );

        // recent works for titles + series
        const wRes = await oaFetch(
          `/works?filter=${encodeURIComponent(
            `${recentFilter},authorships.author.id:${aid}`
          )}&per-page=200&select=id,title,authorships,publication_year`,
          { signal: controller.signal }
        );
        const works = wRes?.results || [];
        const titlesByCollab: Record<string, string[]> = {};
        works.forEach((w: any) => {
          const ids = (w.authorships || [])
            .map((au: any) => extractId(au?.author?.id))
            .filter(Boolean);
          ids.forEach((cid: string) => {
            if (allIds.includes(cid)) {
              (titlesByCollab[cid] ||= []).push(w.title);
            }
          });
        });

        const mainInst = collabAuthor?.last_known_institution_name || "";
        const rows = allIds
          .map((cid: string) => {
            const d: any = dMap.get(cid);
            const org = d?.last_known_institutions?.[0]?.display_name || "–";
            const ctry =
              d?.last_known_institutions?.[0]?.country_code?.toUpperCase?.() ||
              "–";
            const recent = Number(recentMap.get(cid) || 0);
            const total = Number(totalMap.get(cid) || 0);
            const sameInst = mainInst && org && mainInst === org;
            let risk: "low" | "medium" | "high" = "low";
            if (sameInst && recent >= 30) risk = "high";
            else if (sameInst && recent >= 10) risk = "medium";
            return {
              id: cid,
              name: d?.display_name || cid,
              orcid: d?.orcid,
              org,
              country: ctry,
              recent,
              total,
              risk,
              titles: (titlesByCollab[cid] || []).slice(0, 5),
            };
          })
          .sort((a, b) => b.recent - a.recent);

        // series (works per year by risk)
        const rowMap = new Map(rows.map((r) => [r.id, r]));
        const counts: Record<
          number,
          { year: number; low: number; medium: number; high: number }
        > = {};
        works.forEach((w: any) => {
          const year = w.publication_year;
          const ids = (w.authorships || [])
            .map((au: any) => extractId(au?.author?.id))
            .filter(Boolean);
          ids.forEach((cid: string) => {
            const row = rowMap.get(cid);
            if (!row) return;
            counts[year] ||= { year, low: 0, medium: 0, high: 0 };
            counts[year][row.risk] += 1;
          });
        });

        setCollabRows(rows);
        setCollabSeries(Object.values(counts).sort((a, b) => a.year - b.year));
        setLastUpdated(Date.now()); // set ONCE
      } catch (e: any) {
        if (!controller.signal.aborted) setCollabError(e?.message || String(e));
      } finally {
        if (!controller.signal.aborted) setCollabLoading(false);
      }
    })();

    return () => controller.abort();
  }, [collabOpen, collabAuthor, selectedTopic, fromYear, country, selectedInstitution]);

  /* ---------- derived (modal) ---------- */
  const filteredCollabRows = useMemo(
    () =>
      collabRows.filter(
        (r) =>
          (filterOrg === "ALL" || r.org === filterOrg) &&
          (filterCountry === "ALL" || r.country === filterCountry) &&
          (filterRisk === "ALL" || r.risk === filterRisk) &&
          (!collabSearch || r.name.toLowerCase().includes(collabSearch.toLowerCase()) || r.org?.toLowerCase().includes(collabSearch.toLowerCase()))
      ),
    [collabRows, filterOrg, filterCountry, filterRisk, collabSearch]
  );

  const orgOptions = useMemo(
    () =>
      Array.from(new Set(collabRows.map((r) => r.org).filter(Boolean))).sort(),
    [collabRows]
  );
  const countryOptions = useMemo(
    () =>
      Array.from(new Set(collabRows.map((r) => r.country).filter(Boolean))).sort(),
    [collabRows]
  );
  const riskOptions = ["low", "medium", "high"];

  const collabSummary = useMemo(() => {
    const collaborators = filteredCollabRows.length;
    const recentWorks = filteredCollabRows.reduce(
      (s, r) => s + (r.recent || 0),
      0
    );
    const totalWorks = filteredCollabRows.reduce(
      (s, r) => s + (r.total || 0),
      0
    );
    const orgs = new Set(filteredCollabRows.map((r) => r.org).filter(Boolean))
      .size;
    const countries = new Set(
      filteredCollabRows.map((r) => r.country).filter(Boolean)
    ).size;
    const riskCounts = { low: 0, medium: 0, high: 0 } as Record<
      "low" | "medium" | "high",
      number
    >;
    filteredCollabRows.forEach((r) => {
      riskCounts[r.risk] = (riskCounts[r.risk] || 0) + (r.recent || 0);
    });
    return { collaborators, recentWorks, totalWorks, orgs, countries, riskCounts };
  }, [filteredCollabRows]);

  const riskDonutData = useMemo(
    () => [
      { name: "High", key: "high", value: collabSummary.riskCounts.high },
      { name: "Medium", key: "medium", value: collabSummary.riskCounts.medium },
      { name: "Low", key: "low", value: collabSummary.riskCounts.low },
    ],
    [collabSummary]
  );

  const sparkSeries = useMemo(
    () =>
      collabSeries.map((d: any) => ({
        year: d.year,
        total: (d.low || 0) + (d.medium || 0) + (d.high || 0),
      })),
    [collabSeries]
  );

  const getDelta = (series: {year: number, total: number}[]) => {
     if (series.length < 2) return null;
     const last = series[series.length - 1].total;
     const prev = series[series.length - 2].total;
     return prev ? ((last - prev) / prev) * 100 : null;
  }
  const recentDelta = getDelta(sparkSeries);
  const totalSparkSeries = useMemo(() => {
    const yearMap = new Map<number, number>();
    collabRows.forEach(row => {
        // This is a simplified proxy. A real implementation would need to fetch yearly data.
        const year = new Date().getFullYear();
        yearMap.set(year, (yearMap.get(year) || 0) + row.total);
    });
    return Array.from(yearMap.entries()).map(([year, total])=> ({year, total})).sort((a,b) => a.year - b.year);
  }, [collabRows]);
  const totalDelta = getDelta(totalSparkSeries);

  const freshness = useMemo(
    () =>
      lastUpdated
        ? `${Math.max(1, Math.round((Date.now() - lastUpdated) / 60000))}m ago`
        : "—",
    [lastUpdated]
  );

  const presetYears = [
    CURRENT_YEAR - 5,
    CURRENT_YEAR - 7,
    CURRENT_YEAR - 10,
    2010,
    2000,
    1990,
  ];

  const exportCSV = () => {
    const headers = [
      "Collaborator",
      "Organization",
      "Country",
      "Recent",
      "Total",
      "Risk",
      "Work Title",
    ];
    const rows = filteredCollabRows.map((r) =>
      [r.name, r.org, r.country, r.recent, r.total, r.risk, r.titles?.[0] || '']
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `collaborations-${collabAuthor?.display_name || "author"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    if (selectedTopic || selectedInstitution) {
      // Trigger a re-fetch by creating a new object reference
      if (selectedTopic) setSelectedTopic({ ...selectedTopic });
      if (selectedInstitution) setSelectedInstitution({ ...selectedInstitution });
    }
  }

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-slate-50 p-6 font-sans">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-800">
            OpenAlex — Topic Trends &amp; Expert Finder
          </h1>
          <p className="text-slate-600 max-w-3xl">
            Live demo powered by the{" "}
            <a
              className="underline"
              href="https://docs.openalex.org"
              target="_blank"
              rel="noreferrer"
            >
              OpenAlex API
            </a>
            . Pick a topic, choose a start year, and (optionally) filter by
            country to see trends and top researchers. API via polite pool (
            <code>{MAILTO}</code>).
          </p>
        </header>

        {/* Controls */}
        <Card className="p-4">
          <div className="grid gap-4 md:grid-cols-12 items-end">
            <div className="md:col-span-3">
              <Label htmlFor="topic">Find a topic</Label>
              <div className="relative">
                <Input
                  id="topic"
                  placeholder="e.g., dengue, quantum computing"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (e.target.value.trim() === '') {
                        setSelectedTopic(null);
                    }
                  }}
                  className="pr-10"
                />
                <Icons.Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>

              {topicResults.length > 0 && (
                <div className="absolute z-30 mt-2 max-h-60 w-full md:w-auto overflow-auto rounded-xl border bg-white shadow-lg">
                  {topicResults.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTopic(t);
                        setQuery(t.display_name);
                        setTopicResults([]);
                      }}
                      className="block w-full text-left px-3 py-2 hover:bg-slate-50"
                    >
                      <div className="font-medium">{t.display_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

             <div className="md:col-span-3">
              <Label htmlFor="institution">Institution (optional)</Label>
              <div className="relative">
                <Input
                  id="institution"
                  placeholder="e.g., University of Cambridge"
                  value={institutionQuery}
                  onChange={(e) => {
                    setInstitutionQuery(e.target.value);
                    if (e.target.value.trim() === '') {
                        setSelectedInstitution(null);
                    }
                  }}
                  className="pr-10"
                />
                 <Icons.Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
              {institutionResults.length > 0 && (
                 <div className="absolute z-30 mt-2 max-h-60 w-full md:w-auto overflow-auto rounded-xl border bg-white shadow-lg">
                  {institutionResults.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => {
                        setSelectedInstitution(i);
                        setInstitutionQuery(i.display_name);
                        setInstitutionResults([]);
                      }}
                      className="block w-full text-left px-3 py-2 hover:bg-slate-50"
                    >
                      <div className="font-medium">{i.display_name}</div>
                      <div className="text-xs text-slate-500">{i.country_code}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <Label>From year</Label>
              <Select
                value={String(fromYear)}
                onValueChange={(v) => setFromYear(parseInt(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {presetYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label>Country (optional)</Label>
              <Input
                placeholder="e.g., US, CN"
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
              />
            </div>

            <div className="md:col-span-2">
               <Button
                onClick={handleRefresh}
                className="w-full"
                disabled={isInitialState || loading}
              >
                {loading ? (
                  <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Icons.BarChart3 className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </Card>

        {(selectedTopic || selectedInstitution) && (
          <div className="flex flex-wrap items-center gap-2">
            {selectedTopic && 
              <Badge variant="secondary" className="text-sm">
                Topic: {selectedTopic.display_name}
              </Badge>
            }
            {selectedInstitution && (
                 <Badge variant="secondary" className="text-sm">
                    Institution: {selectedInstitution.display_name}
                </Badge>
            )}
            {(selectedTopic || selectedInstitution) &&
                <a
                  href={`https://openalex.org/${extractId(selectedTopic?.id || selectedInstitution?.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline text-slate-600"
                >
                  Open in OpenAlex
                </a>
            }
          </div>
        )}

        {/* Analytics */}
        <div className="grid gap-6 md:grid-cols-5">
          <Card className="md:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Icons.BarChart3 className="h-5 w-5" /> Works per year
              </CardTitle>
            </CardHeader>
            <CardContent>
              {error ? (
                <div className="text-red-600 text-sm p-4 bg-red-50 rounded-md">{error}</div>
              ) : trend.length > 0 && !isInitialState ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trend}
                      margin={{ top: 10, right: 20, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} allowDecimals={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="Works"
                        strokeWidth={2}
                        dot={false}
                        stroke="#3B82F6"
                      />
                       <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="Collaborations"
                        strokeWidth={2}
                        dot={false}
                        stroke="#10B981"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-sm text-slate-500">
                  {loading ? "Loading…" : isInitialState ? "Please select a topic or institution to get started." : "No data for selected filters."}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Icons.PieChart className="h-5 w-5" /> OA status (last 5 years)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {oaGroups.length && !isInitialState ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        dataKey="count"
                        data={oaGroups}
                        nameKey="status"
                        outerRadius={100}
                        innerRadius={60}
                        label={false}
                      >
                        {oaGroups.map((entry, idx) => {
                          const key = String(entry.status || "").toLowerCase();
                          const fill =
                            OA_COLORS[key] || PALETTE[idx % PALETTE.length];
                          return <Cell key={`cell-${idx}`} fill={fill} />;
                        })}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                 <div className="h-64 flex items-center justify-center text-sm text-slate-500">
                  {loading ? "Loading…" : isInitialState ? "Please select a topic or institution to get started." : "No OA breakdown available."}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top authors */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Icons.User className="h-5 w-5" /> Top authors{" "}
              {country ? (
                <span className="text-slate-500 text-sm">in {country}</span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mergedAuthors.length && !isInitialState ? (
              <div className="overflow-auto rounded-xl border">
                <table className="min-w-[1200px] w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-3">Author</th>
                      <th className="text-left p-3">Institution</th>
                      <th className="text-left p-3">Country</th>
                      <th className="text-right p-3">Recent collabs</th>
                      <th className="text-right p-3">Total collabs</th>
                      <th className="text-right p-3">Recent works*</th>
                      <th className="text-right p-3">Total works</th>
                      <th className="text-right p-3">Cited by</th>
                      <th className="text-right p-3">h-index</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedAuthors.map((a: any) => (
                      <tr key={a.id} className="border-t">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <button
                              className="font-medium text-left hover:underline text-slate-800"
                              onClick={() => openCollab(a)}
                            >
                              {a.display_name || a.display}
                            </button>
                            <a
                              className="text-xs underline text-slate-500"
                              href={`https://openalex.org/${a.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              OpenAlex
                            </a>
                            {a.orcid ? (
                              <a
                                className="text-xs underline text-slate-500"
                                href={a.orcid}
                                target="_blank"
                                rel="noreferrer"
                              >
                                ORCID
                              </a>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600">
                          {a.last_known_institution_name || "–"}
                        </td>
                        <td className="p-3 text-slate-600">{a.country_code || "–"}</td>
                        <td className="p-3 text-right">
                          {typeof recentCollabs[a.id] === "number"
                            ? recentCollabs[a.id].toLocaleString()
                            : "–"}
                        </td>
                        <td className="p-3 text-right">
                          {typeof totalCollabs[a.id] === "number"
                            ? totalCollabs[a.id].toLocaleString()
                            : "–"}
                        </td>
                        <td className="p-3 text-right">
                          {a.count?.toLocaleString?.() || "–"}
                        </td>
                        <td className="p-3 text-right">
                          {a.works_count?.toLocaleString?.() || "–"}
                        </td>
                        <td className="p-3 text-right">
                          {a.cited_by_count?.toLocaleString?.() || "–"}
                        </td>
                        <td className="p-3 text-right">{a.h_index ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-xs text-slate-500 p-3">
                  *Recent works = number of works in this topic since {fromYear}{" "}
                  (grouped by author)
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-slate-500">
                {loading ? "Loading…" : isInitialState ? "Please select a topic or institution to get started." : "No authors found for the current filters."}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Collaborations Modal */}
        <Dialog open={collabOpen} onOpenChange={setCollabOpen}>
          <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <DialogTitle className="text-2xl">Collaborator Analytics</DialogTitle>
                        <DialogDescription>
                            Analysis for {collabAuthor?.display_name} in "{selectedTopic?.display_name || 'selected research area'}" since {fromYear}.
                        </DialogDescription>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                             <Icons.UserAvatar className="h-8 w-8 rounded-full" />
                             <span className="font-medium">{collabAuthor?.display_name}</span>
                        </div>
                        <Button variant="secondary"><Icons.Share className="h-4 w-4 mr-2" /> Share</Button>
                        <Button onClick={exportCSV}>Export CSV</Button>
                    </div>
                </div>
            </DialogHeader>

            {collabError ? (
              <div className="text-red-600 text-sm">{collabError}</div>
            ) : collabLoading ? (
              <div className="flex items-center justify-center p-10">
                <Icons.spinner className="h-6 w-6 animate-spin mr-2" /> Loading collaboration data...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Filters */}
                <div className="p-4 border rounded-lg bg-slate-50/50">
                    <div className="grid gap-4 md:grid-cols-12 items-end">
                       <div className="md:col-span-3">
                           <Label>Search</Label>
                           <div className="relative">
                               <Input placeholder="Search collaborators..." value={collabSearch} onChange={e => setCollabSearch(e.target.value)} className="pr-10 bg-white" />
                               <Icons.Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                           </div>
                       </div>
                       <div className="md:col-span-3">
                           <Label>Organization</Label>
                           <Select value={filterOrg} onValueChange={setFilterOrg}>
                               <SelectTrigger><SelectValue placeholder="All Organizations" /></SelectTrigger>
                               <SelectContent>
                                   <SelectItem value="ALL">All Organizations</SelectItem>
                                   {orgOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                               </SelectContent>
                           </Select>
                       </div>
                       <div className="md:col-span-2">
                           <Label>Country</Label>
                           <Select value={filterCountry} onValueChange={setFilterCountry}>
                               <SelectTrigger><SelectValue placeholder="All Countries" /></SelectTrigger>
                               <SelectContent>
                                   <SelectItem value="ALL">All Countries</SelectItem>
                                   {countryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                               </SelectContent>
                           </Select>
                       </div>
                       <div className="md:col-span-2">
                           <Label>Risk</Label>
                           <Select value={filterRisk} onValueChange={setFilterRisk}>
                               <SelectTrigger><SelectValue placeholder="All Risk Levels" /></SelectTrigger>
                               <SelectContent>
                                   <SelectItem value="ALL">All Risk Levels</SelectItem>
                                   {riskOptions.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                               </SelectContent>
                           </Select>
                       </div>
                       <div className="md:col-span-2 flex justify-end gap-2">
                           <Button variant="secondary" onClick={() => { setFilterOrg('ALL'); setFilterCountry('ALL'); setFilterRisk('ALL'); setCollabSearch(''); }}>Reset</Button>
                           <Button>Saved Views</Button>
                       </div>
                    </div>
                </div>

                {/* Scorecards */}
                <div className="pt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-slate-800">Filter Metrics</h3>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Icons.Clock className="h-3 w-3" /> Updated {freshness}
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-5">
                       <Card className="p-4">
                            <div className="text-sm text-slate-500">Collaborators</div>
                            <div className="text-3xl font-bold">{collabSummary.collaborators.toLocaleString()}</div>
                       </Card>
                       <Card className="p-4">
                            <div className="text-sm text-slate-500">Recent Collaborations</div>
                            <div className="flex justify-between items-end">
                               <div className="text-3xl font-bold">{collabSummary.recentWorks.toLocaleString()}</div>
                               <div className="h-10 w-20 -mb-2 -mr-2">
                                  <ResponsiveContainer width="100%" height="100%">
                                      <AreaChart data={sparkSeries}>
                                        <Area type="monotone" dataKey="total" stroke="#4f46e5" fill="#c7d2fe" strokeWidth={2}/>
                                      </AreaChart>
                                  </ResponsiveContainer>
                               </div>
                            </div>
                       </Card>
                       <Card className="p-4">
                            <div className="text-sm text-slate-500">Total Collaborations</div>
                            <div className="flex justify-between items-end">
                              <div className="text-3xl font-bold">{collabSummary.totalWorks.toLocaleString()}</div>
                              <div className="h-10 w-20 -mb-2 -mr-2">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={totalSparkSeries}>
                                      <Area type="monotone" dataKey="total" stroke="#16a34a" fill="#dcfce7" strokeWidth={2}/>
                                    </AreaChart>
                                  </ResponsiveContainer>
                               </div>
                            </div>
                       </Card>
                       <Card className="p-4">
                            <div className="text-sm text-slate-500">Organizations</div>
                            <div className="text-3xl font-bold">{collabSummary.orgs.toLocaleString()}</div>
                       </Card>
                       <Card className="p-4">
                            <div className="text-sm text-slate-500">Countries</div>
                            <div className="text-3xl font-bold">{collabSummary.countries.toLocaleString()}</div>
                       </Card>
                    </div>
                </div>

                {/* Charts */}
                <div className="pt-4">
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Analytics</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card className="p-4">
                          <CardTitle className="mb-4">Risk Over Time</CardTitle>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart
                                data={collabSeries}
                                margin={{ top: 10, right: 20, bottom: 0, left: 0 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Area type="monotone" dataKey="low" name="Low" stackId="1" stroke={RISK_HEX.low} fill={RISK_HEX.low} fillOpacity={0.6} />
                                <Area type="monotone" dataKey="medium" name="Medium" stackId="1" stroke={RISK_HEX.medium} fill={RISK_HEX.medium} fillOpacity={0.6}/>
                                <Area type="monotone" dataKey="high" name="High" stackId="1" stroke={RISK_HEX.high} fill={RISK_HEX.high} fillOpacity={0.6}/>
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                      </Card>

                       <Card className="p-4">
                          <CardTitle className="mb-4">Risk Distribution</CardTitle>
                          <div className="h-64 relative">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={riskDonutData}
                                  dataKey="value"
                                  nameKey="name"
                                  innerRadius="60%"
                                  outerRadius="80%"
                                >
                                  {riskDonutData.map((d) => (
                                    <Cell key={d.key} fill={RISK_HEX[d.key as keyof typeof RISK_HEX]} />
                                  ))}
                                </Pie>
                                <Legend />
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="text-center">
                                <div className="text-3xl font-bold">
                                  {collabSummary.recentWorks?.toLocaleString() || 0}
                                </div>
                                <div className="text-sm text-slate-500">recent works</div>
                              </div>
                            </div>
                          </div>
                      </Card>
                    </div>
                </div>

                {/* Table */}
                <div className="pt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-slate-800">Collaborators</h3>
                        <div className="flex gap-2">
                            <Button variant="secondary"><Icons.Open className="h-4 w-4 mr-2" /> Open profile</Button>
                            <Button variant="secondary" onClick={exportCSV}><Icons.Share className="h-4 w-4 mr-2"/> Export subset</Button>
                        </div>
                    </div>
                    <div className="max-h-[50vh] overflow-auto rounded-lg border min-h-[240px]">
                      <table className="min-w-[1200px] w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10">
                          <tr>
                            <th className="text-left p-3">Collaborator</th>
                            <th className="text-left p-3">Organization</th>
                            <th className="text-left p-3">Country</th>
                            <th className="text-right p-3">Recent</th>
                            <th className="text-right p-3">Total</th>
                            <th className="text-left p-3">Risk</th>
                            <th className="text-left p-3">Work Title</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCollabRows.map((row) => (
                            <tr key={row.id} className="border-t align-top hover:bg-slate-50">
                              <td className="p-3">
                                <div className="flex items-center gap-3">
                                  <Icons.UserAvatar className="h-8 w-8 rounded-full" />
                                  <div>
                                    <a
                                      className="font-medium hover:underline"
                                      href={`https://openalex.org/${row.id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {row.name}
                                    </a>
                                    {row.orcid ? (
                                      <a
                                        className="block text-xs text-slate-500 hover:underline"
                                        // FIX: The `row.orcid` property is a string and should not be invoked as a function.
                                        href={row.orcid}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        ORCID
                                      </a>
                                    ) : <div className="text-xs text-slate-400">No ORCID</div>}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-slate-600">{row.org}</td>
                              <td className="p-3 text-slate-600">{row.country}</td>
                              <td className="p-3 text-right font-medium">
                                {row.recent?.toLocaleString()}
                              </td>
                              <td className="p-3 text-right text-slate-600">
                                {row.total?.toLocaleString()}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${RISK_CHIP[row.risk]}`}
                                >
                                  {row.risk}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600">
                                <div className="truncate max-w-sm" title={row.titles?.[0]}>
                                    {row.titles?.[0] || 'N/A'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
