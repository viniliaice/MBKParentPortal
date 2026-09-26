import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComputedResult } from '@/context/AppContext';
import { getGrade } from '@/data/mockData';
import { useColors } from '@/hooks/useColors';

interface MarksHudProps {
  studentName: string;
  className?: string;
  results: ComputedResult[];
}

function periodSummary(results: ComputedResult[], examType: string) {
  const rows = results.filter(r => r.examType === examType);
  if (rows.length === 0) return null;
  const avg = Math.round(rows.reduce((s, r) => s + (r.score / r.total) * 100, 0) / rows.length) || 0;
  return { subjectCount: rows.length, avgPct: avg };
}

function detailColor(percent: number) {
  if (percent >= 80) return '#2ECC71';
  if (percent >= 50) return '#F59E0B';
  return '#FF5370';
}

/**
 * The child's academic summary shown on the Home tab. Everything comes from the
 * AppContext `results` computation — nothing is invented here.
 */
export default function MarksHud({ studentName, className, results }: MarksHudProps) {
  const c = useColors();

  const { latest, best, latestPct, bestPct, newestDate, strong, weak } = React.useMemo(() => {
    let latestPct = 0;
    let bestPct = 0;
    let latest: ComputedResult | null = null;
    let best: ComputedResult | null = null;
    let newestDate = '';

    for (const r of results) {
      const pct = Math.round((r.score / r.total) * 100) || 0;
      if (pct > bestPct) {
        bestPct = pct;
        best = r;
      }
      if (!r.date) continue;
      if (r.date > newestDate || (r.date === newestDate && pct > latestPct)) {
        newestDate = r.date;
        latestPct = pct;
        latest = r;
      }
    }

    // Strongest / weakest by average percentage over subjects that have data.
    const bySubject = new Map<string, { sum: number; n: number }>();
    for (const r of results) {
      const pct = Math.round((r.score / r.total) * 100) || 0;
      const acc = bySubject.get(r.subject) ?? { sum: 0, n: 0 };
      acc.sum += pct;
      acc.n += 1;
      bySubject.set(r.subject, acc);
    }
    const avgBySubject = Array.from(bySubject.entries())
      .map(([subject, acc]) => ({ subject, avg: Math.round(acc.sum / acc.n) || 0 }));
    avgBySubject.sort((a, b) => b.avg - a.avg);
    const strong = avgBySubject[0] ?? null;
    const weak = avgBySubject.length > 1 ? avgBySubject[avgBySubject.length - 1] : null;

    return { latest, best, latestPct, bestPct, newestDate, strong, weak };
  }, [results]);

  const monthly = periodSummary(results, 'monthly');
  const midterm = periodSummary(results, 'midterm');
  const final = periodSummary(results, 'final');
  const annualAvg = periodSummary(results, 'annual');

  const headline = bestPct > 0 ? bestPct : latestPct;
  const grade = headline > 0 ? getGrade(headline, 100) : null;

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.head}>
        <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>{studentName}</Text>
        {className ? <Text style={[styles.class, { color: c.mutedForeground }]} numberOfLines={1}>{className}</Text> : null}
      </View>

      {headline <= 0 ? (
        <View style={styles.missingRow}>
          <Ionicons name="hourglass-outline" size={20} color={c.mutedForeground} />
          <Text style={[styles.missingText, { color: c.mutedForeground }]}>
            No marks published yet. They will appear here once teachers publish results.
          </Text>
        </View>
      ) : (
        <View style={styles.bigRow}>
          <Text style={[styles.bigValue, { color: c.foreground }]}>{headline}</Text>
          <Text style={[styles.bigPct, { color: c.mutedForeground }]}>%</Text>
          <View style={[styles.gradePill, { backgroundColor: `${detailColor(headline)}22` }]}>
            <Text style={[styles.gradePillText, { color: detailColor(headline) }]}>{grade}</Text>
          </View>
        </View>
      )}

      {best ? (
        <View style={styles.bestRow}>
          <Ionicons name={latest === best ? 'sparkles' : 'ribbon-outline'} size={14} color={detailColor(bestPct)} />
          <Text style={[styles.bestText, { color: c.mutedForeground }]}>
            {latest === best ? 'Latest result' : 'Best so far'}: <Text style={{ color: c.foreground, fontWeight: '700' }}>{best.subject}</Text>
            {' — '}
            <Text style={{ color: detailColor(bestPct), fontWeight: '700' }}>{bestPct}%</Text>
            {latest === best ? '' : ' (highest individual result)'}
          </Text>
        </View>
      ) : null}

      <View style={[styles.divider, { backgroundColor: c.border }]} />

      <View style={styles.periods}>
        <PeriodStat label="Year" value={annualAvg ? `${annualAvg.avgPct}%` : '—'} sub={annualAvg ? `${annualAvg.subjectCount} subject${annualAvg.subjectCount === 1 ? '' : 's'}` : 'No marks yet'} />
        <PeriodStat label="Monthly" value={monthly ? `${monthly.avgPct}%` : '—'} sub={monthly ? `${monthly.subjectCount} subject${monthly.subjectCount === 1 ? '' : 's'}` : 'No marks yet'} />
        <PeriodStat label="Midterm" value={midterm ? `${midterm.avgPct}%` : '—'} sub={midterm ? `${midterm.subjectCount} subject${midterm.subjectCount === 1 ? '' : 's'}` : 'No marks yet'} />
        <PeriodStat label="Final" value={final ? `${final.avgPct}%` : '—'} sub={final ? `${final.subjectCount} subject${final.subjectCount === 1 ? '' : 's'}` : 'No marks yet'} />
      </View>

      {strong || weak ? (
        <View style={styles.swRow}>
          {strong ? (
            <View style={[styles.swItem, { backgroundColor: c.muted }]}>
              <Ionicons name="trending-up" size={14} color="#2ECC71" />
              <Text style={[styles.swText, { color: c.mutedForeground }]} numberOfLines={1}>
                Strong: <Text style={{ color: c.foreground, fontWeight: '700' }}>{strong.subject}</Text>
              </Text>
            </View>
          ) : null}
          {weak && weak.subject !== strong?.subject ? (
            <View style={[styles.swItem, { backgroundColor: c.muted }]}>
              <Ionicons name="trending-down" size={14} color="#F59E0B" />
              <Text style={[styles.swText, { color: c.mutedForeground }]} numberOfLines={1}>
                Needs attention: <Text style={{ color: c.foreground, fontWeight: '700' }}>{weak.subject}</Text>
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {results.length === 0 ? null : (
        <View style={styles.legendRow}>
          <Text style={[styles.legendText, { color: c.mutedForeground }]}>
            {results.length} result{results.length === 1 ? '' : 's'} on file
          </Text>
        </View>
      )}
    </View>
  );
}

function PeriodStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  const c = useColors();
  return (
    <View style={styles.periodStat}>
      <Text style={[styles.periodValue, { color: c.foreground }]}>{value}</Text>
      <Text style={[styles.periodLabel, { color: c.mutedForeground }]}>{label}</Text>
      <Text style={[styles.periodSub, { color: c.mutedForeground }]} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  head: { gap: 2 },
  name: { fontSize: 19, fontWeight: '800' },
  class: { fontSize: 13, marginTop: 1 },
  bigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bigValue: { fontSize: 52, fontWeight: '900', letterSpacing: -1 },
  bigPct: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  gradePill: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, marginLeft: 'auto', marginBottom: 4 },
  gradePillText: { fontSize: 16, fontWeight: '800' },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  bestText: { fontSize: 13 },
  divider: { height: 1 },
  periods: { flexDirection: 'row', gap: 8 },
  periodStat: { flex: 1, gap: 2 },
  periodValue: { fontSize: 18, fontWeight: '800' },
  periodLabel: { fontSize: 11, fontWeight: '600' },
  periodSub: { fontSize: 10 },
  swRow: { gap: 8 },
  swItem: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  swText: { fontSize: 12, flexShrink: 1 },
  missingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  missingText: { fontSize: 13, flex: 1, lineHeight: 18 },
  legendRow: {},
  legendText: { fontSize: 11 },
});
