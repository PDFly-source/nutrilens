import { ProductAnalysis } from '@/types/food';

/**
 * Local-First Report Generator & Web Share Service
 *
 * Generates structured, professional plain-text or HTML reports locally on the client.
 * Never makes external network requests or uploads report artifacts.
 */

function formatVal(val: number | null | undefined, unit: string): string {
  if (val === null || val === undefined) return 'Not detected';
  return `${val} ${unit}`.trim();
}

export function generateReportPlainText(analysis: ProductAnalysis): string {
  const n = analysis.nutrition;
  const divider = '==================================================';

  return `
${divider}
NUTRILENS — FOOD INTELLIGENCE REPORT
SCAN. KNOW. CHOOSE.
${divider}

Date/Time: ${new Date(analysis.timestamp).toLocaleString()}
Scan Mode: ${analysis.scanMode.toUpperCase()}
Product Name: ${analysis.productName}
${analysis.brand ? `Brand: ${analysis.brand}\n` : ''}${analysis.barcode ? `Barcode: ${analysis.barcode}\n` : ''}
OVERALL FOOD INTELLIGENCE SCORE: ${analysis.scores.isScoreAvailable ? `${analysis.scores.overall} / 100` : 'Score Unavailable'}
- Nutrition Score: ${analysis.scores.isScoreAvailable ? `${analysis.scores.nutrition}/100` : 'Pending'}
- Ingredient Profile: ${analysis.scores.ingredients}/100
- Processing Score: ${analysis.scores.processing}/100

PROCESSING LEVEL (NOVA ESTIMATE):
Classification: ${analysis.processingLevel.label}
Summary: ${analysis.processingLevel.description}
${analysis.processingLevel.indicators.length > 0 ? `Markers: ${analysis.processingLevel.indicators.join(', ')}\n` : ''}
NUTRITION FACTS (Per Serving: ${n.servingSize || 'Not detected'}):
- Calories: ${formatVal(n.calories, 'kcal')}
- Protein: ${formatVal(n.protein, 'g')}
- Total Carbohydrate: ${formatVal(n.totalCarbs, 'g')}
  * Dietary Fiber: ${formatVal(n.dietaryFiber, 'g')}
  * Total Sugars: ${formatVal(n.totalSugars, 'g')}
  * Added Sugars: ${formatVal(n.addedSugars, 'g')}
- Total Fat: ${formatVal(n.totalFat, 'g')}
  * Saturated Fat: ${formatVal(n.saturatedFat, 'g')}
  * Trans Fat: ${formatVal(n.transFat, 'g')}
- Cholesterol: ${formatVal(n.cholesterol, 'mg')}
- Sodium: ${formatVal(n.sodium, 'mg')}
${n.salt !== null && n.salt !== undefined ? `- Salt: ${formatVal(n.salt, 'g')}\n` : ''}
ALLERGEN INFORMATION:
${analysis.allergens.length > 0 ? `Detected Allergens: ${analysis.allergens.join(', ')}` : 'No major allergens explicitly detected in statement.'}
(Notice: Always check physical packaging for manufacturer allergen warnings.)

DECONSTRUCTED INGREDIENTS (${analysis.ingredients.length} items):
${analysis.ingredients.length > 0 ? analysis.ingredients.map((i, idx) => `${idx + 1}. ${i.name} [${i.role}] - ${i.concernLevel.toUpperCase()} scrutiny`).join('\n') : 'No ingredients detected.'}

SCORE BREAKDOWN:
${analysis.scores.breakdown.map((b) => `* ${b.factor} (${b.points > 0 ? `+${b.points}` : b.points} pts): ${b.rationale}`).join('\n')}

${analysis.marketingClaims.length > 0 ? `MARKETING CLAIM EVALUATION:\n${analysis.marketingClaims.map((c) => `* "${c.claim}" [${c.status.toUpperCase()}]: ${c.explanation}`).join('\n')}\n` : ''}
SMART FOOD SWAP CRITERIA:
${analysis.swapCriteria.map((s) => `* ${s.label}: ${s.threshold} (${s.reason})`).join('\n')}

${divider}
Generated privately by NutriLens. All calculations executed in-memory.
`;
}

export function downloadPlainTextReport(analysis: ProductAnalysis): void {
  const text = generateReportPlainText(analysis);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nutrilens-${analysis.productName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareProductReport(analysis: ProductAnalysis): Promise<boolean> {
  const text = generateReportPlainText(analysis);
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: `NutriLens Report: ${analysis.productName}`,
        text: text.slice(0, 2000), // Keep within standard share text envelope
      });
      return true;
    } catch {
      // User cancelled or unsupported
      return false;
    }
  } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}

export const downloadLocalReport = downloadPlainTextReport;
export const shareLocalReport = shareProductReport;
