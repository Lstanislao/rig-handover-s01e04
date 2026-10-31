import type { DigestRow, Night } from '../digest/types.js';

// Retries at or above this count are marked; so is any job whose last status is "fail".
const RETRY_FLAG = 3;

function flagged(row: DigestRow): boolean {
  return row.retries >= RETRY_FLAG || row.lastStatus === 'fail';
}

function DigestRowView({ row }: { row: DigestRow }) {
  const warn = flagged(row);
  return (
    <tr class={warn ? 'warn' : undefined}>
      <td>{row.job}</td>
      <td>{row.owner ?? '—'}</td>
      <td>{row.runs}</td>
      <td>
        {row.retries}
        {row.retries >= RETRY_FLAG ? ' · retries' : ''}
      </td>
      <td>{row.lastStatus}</td>
      <td>{row.lastError ?? '—'}</td>
      <td>{row.first}</td>
      <td>{row.last}</td>
    </tr>
  );
}

export function DigestView({ night }: { night: Night }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => (
              <DigestRowView row={row} />
            ))}
          </tbody>
        </table>
      )}
      {night.badLines > 0 ? (
        <p class="mute">
          {night.badLines} unreadable {night.badLines === 1 ? 'line' : 'lines'} skipped
        </p>
      ) : null}
    </>
  );
}
