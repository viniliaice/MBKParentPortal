import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Card } from '@/components/Card';
import { useColors } from '@/hooks/useColors';
import { formatMonthYear, gradeColorFor, gradeFor, percentage, type ReportResult } from '@/lib/reportSelectors';

interface Props {
  result: ReportResult;
  /** Hidden on the dashboard preview, shown on the marks screen. */
  showComponents?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** One subject's published result: the mark, the grade and how the mark was built. */
export function SubjectResultCard({ result, showComponents = true, style }: Props) {
  const c = useColors();
  const tone = { success: c.accent, warning: c.warning, danger: c.destructive };
  const pct = percentage(result.score, result.total);
  const color = gradeColorFor(result.score, result.total, tone);
  const period = formatMonthYear(result.date, result.month);

  return (
    <Card style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.subject, { color: c.foreground }]} numberOfLines={2}>{result.subject}</Text>
          {period ? <Text style={[styles.period, { color: c.textDim }]}>{period}</Text> : null}
        </View>
        <View style={[styles.gradePill, { backgroundColor: pct >= 60 ? c.primarySoft : c.surfaceMuted }]}>
          <Text style={[styles.grade, { color }]}>{gradeFor(result.score, result.total)}</Text>
        </View>
      </View>

      <View style={[styles.track, { backgroundColor: c.surfaceSunken }]}>
        <View style={[styles.fill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
      </View>

      <View style={styles.metaRow}>
        <Text style={[styles.score, { color: c.textSecondary }]}>{result.score} / {result.total}</Text>
        <Text style={[styles.pct, { color }]}>{pct}%</Text>
      </View>

      {showComponents && result.components.length > 0 ? (
        <View style={[styles.breakdown, { borderTopColor: c.border }]}>
          {result.components.map((component, index) => {
            const componentPct = percentage(component.score, component.total);
            return (
              <View key={`${component.name}-${index}`} style={styles.componentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.componentName, { color: c.textSecondary }]} numberOfLines={2}>
                    {component.name}
                  </Text>
                  <View style={[styles.componentTrack, { backgroundColor: c.surfaceSunken }]}>
                    <View
                      style={[
                        styles.componentFill,
                        { width: `${Math.min(componentPct, 100)}%`, backgroundColor: gradeColorFor(component.score, component.total, tone) },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.componentMeta}>
                  <Text style={[styles.componentPct, { color: c.foreground }]}>{componentPct}%</Text>
                  <Text style={[styles.componentWeight, { color: c.textDim }]}>counts {component.weight}%</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  subject: { fontSize: 15.5, fontWeight: '700' },
  period: { fontSize: 11.5, marginTop: 2 },
  gradePill: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 5, minWidth: 44, alignItems: 'center' },
  grade: { fontSize: 14, fontWeight: '800' },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  score: { fontSize: 12.5 },
  pct: { fontSize: 13.5, fontWeight: '700' },
  breakdown: { marginTop: 6, paddingTop: 10, borderTopWidth: 1, gap: 10 },
  componentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  componentName: { fontSize: 12, marginBottom: 5 },
  componentTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  componentFill: { height: 4, borderRadius: 2 },
  componentMeta: { alignItems: 'flex-end', minWidth: 64 },
  componentPct: { fontSize: 12.5, fontWeight: '700' },
  componentWeight: { fontSize: 10.5 },
});
