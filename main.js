class Dashboard {
    constructor() {
        this.data = {
            transactions: [],
            metrics: {},
            history: []
        };
        this.profitChart = null;
        this.isLoading = true;
        this.currentFilter = 'all';
        
        // Security Key (matches n8n)
        this.apiKey = 'finacia_secret_key_2026';
        this.password = 'financia2026'; // Predefined password

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.checkAuth();
    }

    checkAuth() {
        const isAuth = localStorage.getItem('FinancIA_Auth_v3') === 'true';
        if (isAuth) {
            document.getElementById('login-overlay').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            this.fetchData();
        }
    }

    setupEventListeners() {
        // Login Logic
        const loginBtn = document.getElementById('login-btn');
        const passInput = document.getElementById('dashboard-pass');
        
        const handleLogin = () => {
            if (passInput.value === this.password) {
                localStorage.setItem('FinancIA_Auth_v3', 'true');
                document.getElementById('login-overlay').classList.add('hidden');
                document.getElementById('app').classList.remove('hidden');
                this.fetchData();
            } else {
                document.getElementById('login-error').classList.remove('hidden');
            }
        };

        loginBtn?.addEventListener('click', handleLogin);
        passInput?.addEventListener('keypress', (e) => { if(e.key === 'Enter') handleLogin(); });

        // Filtros de tabla
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderTable();
            });
        });
    }

    async fetchData() {
        try {
            const response = await fetch('https://n8n.10tacle.app/webhook/finacia-unified-data', {
                headers: {
                    'X-Dashboard-Key': this.apiKey
                }
            });
            if (!response.ok) throw new Error("Acceso denegado o error de servidor");
            
            const result = await response.json();
            
            // Expected payload: { business: { transactions: [...] } }
            if (result && result.business) {
                this.data.transactions = result.business.transactions || [];
                this.calculateMetrics();
                this.isLoading = false;
                this.renderAll();
            } else {
                throw new Error("Formato de datos no válido desde n8n");
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            const tbody = document.querySelector('#transactions-table tbody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--rose);">
                    Error de conexión: ${error.message}. Por favor revisa n8n.
                </td></tr>`;
            }
        }
    }

    calculateMetrics() {
        const t = this.data.transactions;
        if (!t || t.length === 0) return;

        // Group by Month
        const monthlyMap = {};
        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        const sortedTransactions = [...t].sort((a,b) => {
            const [dA, mA, yA] = a.date.split('/');
            const [dB, mB, yB] = b.date.split('/');
            return new Date(yA, mA-1, dA) - new Date(yB, mB-1, dB);
        });

        sortedTransactions.forEach(x => {
            const [d, m, y] = x.date.split('/');
            const key = `${y}-${m.padStart(2, '0')}`;
            if (!monthlyMap[key]) {
                const monthName = monthNames[parseInt(m)-1];
                monthlyMap[key] = { label: `${monthName} ${y.slice(-2)}`, value: 0 };
            }
            
            if (x.type === 'Venta') {
                monthlyMap[key].value += x.amount;
            } else {
                monthlyMap[key].value -= Math.abs(x.amount);
            }
        });

        const history = Object.keys(monthlyMap).sort().map(k => monthlyMap[k]);

        const totalSales = t.filter(x => x.type === 'Venta').reduce((acc, curr) => acc + curr.amount, 0);
        const totalPurchases = t.filter(x => x.type === 'Compra').reduce((acc, curr) => acc + curr.amount, 0);
        const totalAds = t.filter(x => x.type === 'Publicidad').reduce((acc, curr) => acc + curr.amount, 0);
        const totalSpent = totalPurchases + totalAds;
        const totalNetProfit = totalSales - totalSpent;
        const finalROI = totalSpent > 0 ? (totalNetProfit / totalSpent) * 100 : 0;

        this.data.metrics = {
            sales: totalSales,
            purchases: totalPurchases,
            ads: totalAds,
            totalSpent: totalSpent,
            netProfit: totalNetProfit,
            roi: finalROI
        };

        this.data.history = history;
    }

    renderAll() {
        this.renderMetrics();
        this.renderChart();
        this.renderDistributionChart();
        this.renderTable();
    }

    renderDistributionChart() {
        const ctx = document.getElementById('distributionChart').getContext('2d');
        if (this.distChart) this.distChart.destroy();

        const sales = this.data.metrics.sales;
        const investment = this.data.metrics.purchases + this.data.metrics.ads;

        this.distChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Ventas', 'Inversión (Compras + Ads)'],
                datasets: [{
                    data: [sales, investment],
                    backgroundColor: ['rgba(56, 189, 248, 0.7)', 'rgba(244, 63, 94, 0.7)'],
                    borderColor: ['#38bdf8', '#f43f5e'],
                    borderWidth: 2,
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'Outfit', size: 12 },
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 12,
                        cornerRadius: 12,
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) label += ': ';
                                if (context.parsed !== null) {
                                    label += '€' + context.parsed.toLocaleString('es-ES');
                                }
                                return label;
                            }
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }

    renderMetrics() {
        const m = this.data.metrics;
        document.getElementById('net-profit').innerText = `€${m.netProfit.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('roi-value').innerText = `${m.roi.toFixed(1)}%`;
        document.getElementById('total-spent').innerText = `€${m.totalSpent.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

        document.getElementById('summary-value-1').innerText = `€${m.sales.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('summary-value-2').innerText = `€${m.purchases.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('summary-value-3').innerText = `€${m.ads.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    }

    renderChart() {
        const ctx = document.getElementById('profitChart').getContext('2d');
        if (this.profitChart) this.profitChart.destroy();

        const labels = this.data.history.map(h => h.label);
        const values = this.data.history.map(h => h.value);

        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
        gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');

        this.profitChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Beneficio Mensual',
                    data: values,
                    backgroundColor: values.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(244, 63, 94, 0.6)'),
                    borderColor: values.map(v => v >= 0 ? '#10b981' : '#f43f5e'),
                    borderWidth: 2,
                    borderRadius: 8,
                    hoverBackgroundColor: values.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(244, 63, 94, 0.8)'),
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleFont: { family: 'Outfit', size: 14, weight: 'bold' },
                        bodyFont: { family: 'Outfit', size: 13 },
                        padding: 12,
                        cornerRadius: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Beneficio: €${context.parsed.y.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                scales: {
                    y: { 
                        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                        ticks: { 
                            color: '#94a3b8', 
                            font: { family: 'Outfit' },
                            callback: function(value) {
                                return '€' + value.toLocaleString('es-ES');
                            }
                        }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                    }
                }
            }
        });
    }

    renderTable() {
        const tbody = document.querySelector('#transactions-table tbody');
        if (!tbody) return;

        const filtered = this.currentFilter === 'all' 
            ? this.data.transactions 
            : this.data.transactions.filter(t => t.type === this.currentFilter);

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No hay transacciones registradas.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(t => {
            const isNegative = t.type === 'Compra' || t.type === 'Publicidad';
            return `
                <tr>
                    <td>${t.date || '-'}</td>
                    <td>${t.item || '-'}</td>
                    <td><span class="type-tag ${this.getTypeClass(t.type)}">${t.type}</span></td>
                    <td style="color: ${isNegative ? 'var(--rose)' : 'var(--emerald)'}">
                        ${isNegative ? '-' : '+'}${Math.abs(t.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                    </td>
                </tr>
            `;
        }).join('');
    }

    getTypeClass(type) {
        switch(type) {
            case 'Venta': return 'emerald-tag';
            case 'Compra': return 'rose-tag';
            case 'Publicidad': return 'indigo-tag';
            default: return '';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});
