/**
 * GhostName audit view: the MCP App rendered inside the host's sandboxed
 * iframe for ghostname_audit_ens_privacy and ghostname_reaudit_ens_privacy.
 *
 * It only renders what the host hands it (the tool's structuredContent) and
 * offers one action, "Open secure upgrade", which asks the host to open the
 * handoff URL through its open-link capability. It touches no wallet,
 * generates no key, stores nothing, and returns no secret to the host. The
 * text and structured result remain the authoritative fallback for hosts
 * without MCP Apps support.
 */
import { App } from '@modelcontextprotocol/ext-apps';
import type { AgentFinding, AgentPrivacyReport, RecommendedAction } from '../../src/agent/types';

const NOT_ANONYMITY =
  'Forward recipient-address privacy for compatible senders, not anonymity. Amounts, sender ' +
  'identity, timing, history and name ownership stay public.';

type ReauditShape = { current: AgentPrivacyReport; resolvedFindings: string[]; remainingFindings: string[]; newFindings: string[]; summary: string };

/* ------------------------------------------------------------------ */
/* Small DOM helpers. Everything is textContent; nothing is innerHTML.  */
/* ------------------------------------------------------------------ */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: { className?: string; text?: string } = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs.className) node.className = attrs.className;
  if (attrs.text !== undefined) node.textContent = attrs.text;
  for (const child of children) node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}

function pill(text: string, kind: 'ok' | 'warn' | 'bad' | '' = ''): HTMLSpanElement {
  return el('span', { className: `pill ${kind}`.trim(), text });
}

function statusKind(status: AgentPrivacyReport['status']): 'ok' | 'warn' | 'bad' | '' {
  if (status === 'private-ready') return 'ok';
  if (status === 'incomplete') return 'warn';
  if (status === 'misconfigured') return 'bad';
  return '';
}

function severityKind(severity: AgentFinding['severity']): 'ok' | 'warn' | 'bad' | '' {
  if (severity === 'critical') return 'bad';
  if (severity === 'warning') return 'warn';
  return '';
}

function list(items: string[], className = 'small'): HTMLUListElement {
  return el('ul', { className }, items.map((item) => el('li', { text: item })));
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function findingsTable(findings: AgentFinding[]): HTMLTableElement {
  const head = el('thead', {}, [
    el('tr', {}, [el('th', { text: 'Code' }), el('th', { text: 'Severity' }), el('th', { text: 'Evidence' }), el('th', { text: 'Finding' })]),
  ]);
  const body = el(
    'tbody',
    {},
    findings.map((f) =>
      el('tr', {}, [
        el('td', { className: 'mono' }, [f.code + (f.recordKey ? ` (${f.recordKey})` : '')]),
        el('td', {}, [pill(f.severity, severityKind(f.severity))]),
        el('td', {}, [pill(f.evidence, f.evidence === 'unknown' ? 'warn' : '')]),
        el('td', {}, [f.title]),
      ]),
    ),
  );
  return el('table', { className: 'plain' }, [head, body]);
}

function actionsList(actions: RecommendedAction[]): HTMLUListElement {
  return el(
    'ul',
    { className: 'small' },
    actions.map((a) =>
      el('li', {}, [
        el('span', { className: 'mono', text: a.code }),
        ' ',
        pill(a.status, a.status === 'open' ? 'warn' : a.status === 'satisfied' ? 'ok' : ''),
        a.humanActionRequired ? ' ' : '',
        a.humanActionRequired ? pill('human wallet action') : '',
        `: ${a.title}. `,
        el('span', { className: 'dim', text: a.safeNextStep }),
      ]),
    ),
  );
}

function renderReport(app: App, report: AgentPrivacyReport, reaudit?: ReauditShape): HTMLElement {
  const root = el('div');

  const header = el('div', { className: 'card' });
  header.append(el('span', { className: 'label', text: reaudit ? 'GhostName re-audit' : 'GhostName audit' }));
  header.append(
    el('div', { className: 'row' }, [
      el('h1', { className: 'mono', text: `${report.name} (chain ${report.chainId})` }),
      pill(report.status, statusKind(report.status)),
    ]),
  );
  header.append(el('p', { className: 'small', text: report.summary }));
  if (reaudit) {
    header.append(el('p', { className: 'small dim', text: reaudit.summary }));
    header.append(
      el('p', { className: 'small' }, [
        'Resolved: ',
        el('span', { className: 'mono', text: reaudit.resolvedFindings.join(', ') || 'none' }),
        '. Remaining: ',
        el('span', { className: 'mono', text: reaudit.remainingFindings.join(', ') || 'none' }),
        '. New: ',
        el('span', { className: 'mono', text: reaudit.newFindings.join(', ') || 'none' }),
        '.',
      ]),
    );
  }
  root.append(header);

  const findings = el('div', { className: 'card inset' });
  findings.append(el('span', { className: 'label', text: 'Findings (observed = chain data, model = privacy model, unknown = not established)' }));
  findings.append(findingsTable(report.findings));
  root.append(findings);

  const actions = el('div', { className: 'card inset' });
  actions.append(el('span', { className: 'label', text: 'Recommended actions' }));
  actions.append(actionsList(report.recommendedActions));
  root.append(actions);

  if (report.warnings.length) {
    const warnings = el('div', { className: 'card danger' });
    warnings.append(el('span', { className: 'label', text: 'Warnings' }));
    warnings.append(list(report.warnings));
    root.append(warnings);
  }

  if (report.unknowns.length) {
    const unknowns = el('div', { className: 'card' });
    unknowns.append(el('span', { className: 'label', text: 'Unknown: not established, not assumed' }));
    unknowns.append(list(report.unknowns, 'small dim'));
    root.append(unknowns);
  }

  const compare = el('div', { className: 'compare' }, [
    el('div', { className: 'col stealth' }, [el('div', { className: 'title', text: 'Protected' }), list(report.protected)]),
    el('div', { className: 'col static' }, [el('div', { className: 'title', text: 'Not protected' }), list(report.notProtected)]),
  ]);
  root.append(compare);

  const handoff = el('div', { className: `card ${report.secureHandoff.available ? 'ok' : 'inset'}` });
  handoff.append(el('span', { className: 'label', text: 'Secure upgrade' }));
  handoff.append(el('p', { className: 'small', text: report.secureHandoff.note }));
  if (report.secureHandoff.available && report.secureHandoff.url) {
    const url = report.secureHandoff.url;
    const button = el('button', { text: 'Open secure upgrade' });
    const note = el('p', { className: 'small dim url', text: url });
    button.addEventListener('click', () => {
      button.disabled = true;
      void app
        .openLink({ url })
        .catch(() => {
          note.textContent = `Your host could not open links. Copy this URL into a browser: ${url}`;
        })
        .finally(() => {
          button.disabled = false;
        });
    });
    handoff.append(el('div', { className: 'row' }, [button, pill('keys generated in your browser, not here', 'ok')]));
    handoff.append(note);
  }
  root.append(handoff);

  root.append(
    el('p', { className: 'small dim' }, [
      `Report id ${report.reportId}. ${report.observation.mode} mode, visible to ${report.observation.visibleTo.join(' and ')}. `,
      'This view holds no wallet and no key. ',
      NOT_ANONYMITY,
    ]),
  );
  return root;
}

function renderError(message: string): HTMLElement {
  const card = el('div', { className: 'card danger' });
  card.append(el('span', { className: 'label', text: 'GhostName tool error' }));
  card.append(el('p', { className: 'small', text: message }));
  return card;
}

function isReport(value: unknown): value is AgentPrivacyReport {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { schemaVersion?: unknown }).schemaVersion === 1 &&
    Array.isArray((value as { findings?: unknown }).findings) &&
    typeof (value as { reportId?: unknown }).reportId === 'string'
  );
}

function isReaudit(value: unknown): value is ReauditShape {
  return typeof value === 'object' && value !== null && isReport((value as { current?: unknown }).current);
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

function applyTheme(theme: unknown): void {
  document.documentElement.dataset['theme'] = theme === 'light' ? 'light' : 'dark';
}

function main(): void {
  const root = document.getElementById('root')!;
  const app = new App({ name: 'GhostName audit view', version: '0.1.0' });

  const show = (node: HTMLElement) => {
    root.replaceChildren(node);
  };

  app.ontoolinput = (input) => {
    const args = (input as { arguments?: Record<string, unknown> }).arguments ?? {};
    const name = typeof args['name'] === 'string' ? args['name'] : 'the name';
    show(el('p', { className: 'small dim', text: `Auditing ${name} live, read-only…` }));
  };

  app.ontoolresult = (result) => {
    const r = result as { isError?: boolean; structuredContent?: unknown; content?: Array<{ type: string; text?: string }> };
    if (r.isError) {
      const text = (r.content ?? []).map((c) => c.text ?? '').join(' ');
      show(renderError(text || 'The tool returned an error.'));
      return;
    }
    let structured: unknown = r.structuredContent;
    if (structured === undefined) {
      // Hosts that drop structuredContent still send the JSON text block.
      const jsonBlock = (r.content ?? []).map((c) => c.text ?? '').find((t) => t.trim().startsWith('{'));
      try {
        structured = jsonBlock ? JSON.parse(jsonBlock) : undefined;
      } catch {
        structured = undefined;
      }
    }
    if (isReaudit(structured)) {
      show(renderReport(app, structured.current, structured));
    } else if (isReport(structured)) {
      show(renderReport(app, structured));
    } else {
      show(renderError('The result did not contain a GhostName report. The text result is authoritative.'));
    }
  };

  app.onhostcontextchanged = (ctx) => applyTheme((ctx as { theme?: unknown }).theme);

  app
    .connect()
    .then(() => applyTheme(app.getHostContext()?.theme))
    .catch((err: unknown) => {
      show(renderError(`Could not connect to the host: ${err instanceof Error ? err.message : String(err)}`));
    });
}

main();
