'use client';

/**
 * Renders the recognition-engine self-test report (local, nothing uploaded).
 * Used by the Scan Hub error card and Settings → Diagnostics.
 */
import type { RecognitionDiagnosticReport } from './recognition-diagnostics';

export function SelfTestPanel({ report }: { report: RecognitionDiagnosticReport }) {
  return (
    <div className="rounded-2xl border p-4 text-[11px] font-mono space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">
          Engine self-test — {report.success ? 'ALL STAGES PASSED' : `FAILED AT: ${report.failureStage}`}
        </span>
        <button
          type="button"
          className="px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-700 text-[10px] hover:bg-stone-100 dark:hover:bg-stone-800 shrink-0"
          onClick={() => navigator.clipboard?.writeText(JSON.stringify(report, null, 2)).catch(() => {})}
        >
          Copy report
        </button>
      </div>
      <div>
        build: {report.appVersion} ({report.commitSha}) · cache: {report.modelCacheState} · vision: {report.visionStatusBefore} · SAB: {report.sharedArrayBuffer ? 'yes' : 'no'}
      </div>
      {report.stages.map((st) => (
        <div key={st.stage}>
          {st.ok ? '✔' : '✖'} {st.stage} — {st.ms} ms
          {st.httpStatus ? ` · HTTP ${st.httpStatus}` : ''}
          {st.bytes ? ` · ${st.bytes} bytes` : ''}
          {st.mime ? ` · ${st.mime}` : ''}
          {st.detail ? ` · ${st.detail}` : ''}
        </div>
      ))}
    </div>
  );
}
