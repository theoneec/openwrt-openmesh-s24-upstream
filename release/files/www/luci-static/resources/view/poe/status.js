'use strict';
'require view';
'require rpc';
'require poll';
'require dom';
'require ui';

/*
 * LuCI PoE control page for the Datto S24-L / Open Mesh S24.
 * Backend: /usr/libexec/rpcd/luci.poe (ubus object luci.poe).
 *   status -> { ports: [ {port, admin, detection, class, power_mw,
 *                          limit_mw, priority} x24 ], total_mw, budget_w }
 *   set    -> { port, state, limit } -> { ok: true } | { error: "..." }
 *
 * Security note: this view is UX only. All input validation is enforced
 * server-side in the rpcd backend (port 1..24, state on|off, limit 0..30000);
 * nothing here is trusted as a boundary. All server-supplied strings are
 * rendered as text nodes via E()/dom (never innerHTML) so a hostile ethtool
 * string cannot inject markup.
 */

var callStatus = rpc.declare({
	object: 'luci.poe',
	method: 'status',
	expect: { }
});

var callSet = rpc.declare({
	object: 'luci.poe',
	method: 'set',
	params: [ 'port', 'state', 'limit' ],
	expect: { }
});

// Render an integer milliwatt value as a watt string, defensively.
function mW2W(v) {
	var n = parseInt(v, 10);
	if (isNaN(n) || n < 0)
		return '-';
	return (n / 1000).toFixed(1);
}

return view.extend({
	handleToggle: function(port, newState, ev) {
		return callSet(port, newState).then(L.bind(function(res) {
			if (res && res.error) {
				ui.addNotification(null,
					E('p', {}, _('PoE change failed: %s').format(res.error)),
					'danger');
				return;
			}
			/* Refresh immediately so the button reflects the new state. */
			return this.refresh();
		}, this)).catch(function(err) {
			ui.addNotification(null,
				E('p', {}, _('PoE request error: %s').format(err.message || err)),
				'danger');
		});
	},

	renderRows: function(ports) {
		var rows = [];

		if (!Array.isArray(ports) || ports.length === 0) {
			return [ E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': '8' },
					E('em', {}, _('No PoE data available')))
			]) ];
		}

		ports.forEach(L.bind(function(p) {
			p = p || {};
			var port = parseInt(p.port, 10);
			if (isNaN(port))
				return;

			var admin = (p.admin != null && p.admin !== '') ? String(p.admin) : '-';
			var enabled = (admin === 'enabled');
			var next = enabled ? 'off' : 'on';
			var prio = parseInt(p.priority, 10);

			rows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'data-title': _('Port') }, 'lan' + port),
				E('td', { 'class': 'td', 'data-title': _('Admin') }, admin),
				E('td', { 'class': 'td', 'data-title': _('Detection') },
					(p.detection != null && p.detection !== '') ? String(p.detection) : '-'),
				E('td', { 'class': 'td', 'data-title': _('Class') },
					(p['class'] != null && p['class'] !== '') ? String(p['class']) : '-'),
				E('td', { 'class': 'td', 'data-title': _('Power (W)') }, mW2W(p.power_mw)),
				E('td', { 'class': 'td', 'data-title': _('Limit (W)') }, mW2W(p.limit_mw)),
				E('td', { 'class': 'td', 'data-title': _('Priority') },
					(!isNaN(prio) && prio >= 0) ? String(prio) : '-'),
				E('td', { 'class': 'td cbi-section-actions' }, [
					E('button', {
						'class': 'btn cbi-button ' +
							(enabled ? 'cbi-button-remove' : 'cbi-button-apply'),
						'aria-label': (enabled
							? _('Disable PoE on port lan%d')
							: _('Enable PoE on port lan%d')).format(port),
						'click': ui.createHandlerFn(this, 'handleToggle', port, next)
					}, enabled ? _('Disable') : _('Enable')), ' ', E('button', { 'class': 'btn cbi-button cbi-button-action', 'title': _('Power-cycle PoE on port lan%d').format(port), 'click': ui.createHandlerFn(this, 'handleToggle', port, 'reset') }, _('Reset'))
				])
			]));
		}, this));

		return rows;
	},

	renderSummary: function(data) {
		var totalW = mW2W(data.total_mw);
		var budgetW = parseInt(data.budget_w, 10);
		if (isNaN(budgetW))
			budgetW = 0;

		var totalNum = parseFloat(totalW);
		var pct = (budgetW > 0 && !isNaN(totalNum))
			? Math.min(100, Math.round((totalNum / budgetW) * 100)) : 0;

		return E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _('Total draw')),
			E('div', { 'class': 'cbi-value-field' }, [
				E('div', {
					'class': 'cbi-progressbar',
					'title': '%s W / %d W'.format(totalW, budgetW)
				}, E('div', { 'style': 'width:%d%%'.format(pct) })),
				E('div', {},
					_('%s W of %d W budget').format(totalW, budgetW))
			])
		]);
	},

	refresh: function() {
		return L.resolveDefault(callStatus(), {}).then(L.bind(function(data) {
			data = data || {};
			var tbody = document.getElementById('poe-tbody');
			var summary = document.getElementById('poe-summary');
			if (tbody)
				dom.content(tbody, this.renderRows(data.ports));
			if (summary)
				dom.content(summary, this.renderSummary(data));
		}, this));
	},

	load: function() {
		return L.resolveDefault(callStatus(), {});
	},

	render: function(data) {
		data = data || {};

		var table = E('table', { 'class': 'table cbi-section-table', 'id': 'poe-table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Port')),
				E('th', { 'class': 'th' }, _('Admin')),
				E('th', { 'class': 'th' }, _('Detection')),
				E('th', { 'class': 'th' }, _('Class')),
				E('th', { 'class': 'th' }, _('Power (W)')),
				E('th', { 'class': 'th' }, _('Limit (W)')),
				E('th', { 'class': 'th' }, _('Priority')),
				E('th', { 'class': 'th cbi-section-actions' }, _('Action'))
			])
		]);

		var tbody = E('tbody', { 'id': 'poe-tbody' }, this.renderRows(data.ports));
		table.appendChild(tbody);

		var summary = E('div', { 'id': 'poe-summary' }, this.renderSummary(data));

		/* Auto-refresh every 5s. poll de-registers on view teardown. */
		poll.add(L.bind(this.refresh, this), 5);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('PoE Port Control')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Per-port Power-over-Ethernet status and control for the 24 switch ports. Values refresh automatically every 5 seconds.')),
			E('div', { 'class': 'cbi-section' }, [ summary ]),
			E('div', { 'class': 'cbi-section' }, [ table ])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
